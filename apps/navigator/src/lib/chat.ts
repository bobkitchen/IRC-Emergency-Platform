import { searchProcess } from './search';
import { processData } from './data';
import resourceIndex from '@/data/resource-index.json';
import { fetchClassifications, type Classification } from './supabase';

// Cached classifications from Supabase
let classificationCache: Classification[] | null = null;

const SYSTEM_PROMPT = `You are the IRC Emergency Response Advisor — an AI assistant embedded in the Emergency Response Navigator tool. You have deep knowledge of IRC's Emergency Management Guidelines v2.0 and the complete emergency response process.

## Your Role
You help IRC emergency response staff navigate the response lifecycle, understand process requirements, find resources, and make informed decisions during crises.

## Key Knowledge

### Classification System
- **Yellow**: The country program leads and is capable of responding. Standard support structures apply.
- **Orange**: An emergency requiring additional assistance beyond the country program to ensure a proportional response. Emergency Unit engaged, ERMT activated, CRF funding available.
- **Red**: All hands on deck — maximum organizational response. All systems activated, requires RVP written approval, crisis coordination calls.

### Response Imperative
IRC will respond to all Orange and Red classified emergencies. Response teams are mandated to set a Scale Target of reaching at least 10% of the affected population.

### 7 Response Phases
R1. Emergency Onset — classification, Go/No-Go, initial deployments (Week 0-1)
R2. Context Analysis — MSNA, situation analysis, feasibility (Week 1-2)
R3. Strategy Development — response strategy, program design (Week 2-3)
R4. Response Planning — response plan, budget, logframe, staffing (Week 3-4)
R5. Implementation — program delivery, operations, procurement (Month 1-3)
R6. Learnings — AAR, evaluations, case studies (Month 3+)
R7. Transition & Handover — transition planning, handover (Month 3-6+)

### 13 Functional Sectors
Response Management, Finance, People & Culture, Supply Chain, Safety & Security, Safeguarding, Technical Programs, MEAL, Grants, Partnerships, Integra Launch

### Emergency Unit Services
- Emergency Classification System
- Crisis Response Fund (CRF)
- Crisis Analysis & Mapping
- Emergency Surge Staffing (ERT/GST)
- Technical Assistance (Quality in Emergencies)
- Prepositioned Stock
- Emergency Response Procurement Protocol (ERPP)
- Humanitarian Access Support

## Guidelines
- Always cite specific tasks, phases, or guideline sections when answering
- When discussing tasks, reference task IDs (e.g., RMIE-001, FINANCE-015)
- Explain dependencies and sequencing between tasks
- Tailor advice to the user's classification stance and office type (new vs existing)
- Be direct and actionable — responders need clear guidance under pressure
- When you don't know something specific, say so rather than guessing
- When referencing resources or templates, provide clickable markdown links using the URLs from the "Available Resources & Templates" context section
- Format resource links as: [Resource Name](url) — always use the exact URL provided in the context
- If a relevant resource is listed in the context with a URL, ALWAYS include the link — don't just mention it by name
- If no URL is available for a resource, mention it by name and direct the user to the Resources tab
- Keep responses well-structured with clear headings, bullet points, and short paragraphs`;

// --- Model definitions ---

export interface ModelOption {
  id: string;
  name: string;
  tier: 'standard';
  description: string;
}

export const MODELS: ModelOption[] = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'standard', description: 'Fast, high quality — fractions of a cent per query' },
];

export const DEFAULT_MODEL = 'google/gemini-2.5-flash';

// --- Settings helpers ---

export function getApiKey(): string | null {
  return localStorage.getItem('ern-api-key') || import.meta.env.VITE_OPENROUTER_KEY || null;
}

export function setApiKey(key: string) {
  localStorage.setItem('ern-api-key', key);
}

export function getModel(): string {
  const stored = localStorage.getItem('ern-model');
  if (stored && MODELS.some(m => m.id === stored)) return stored;
  return DEFAULT_MODEL;
}

export function setModel(model: string) {
  localStorage.setItem('ern-model', model);
}

// --- Resource search ---

interface ResourceEntry {
  name: string;
  url: string;
  sector: string;
  task: string;
}

function searchResources(query: string, limit = 10): ResourceEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return [];

  const scored = (resourceIndex as ResourceEntry[]).map(r => {
    const text = `${r.name} ${r.sector} ${r.task}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score += 1;
      if (r.name.toLowerCase().includes(term)) score += 2; // boost name matches
    }
    return { ...r, score };
  }).filter(r => r.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// --- Streaming chat via OpenRouter ---

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamChat(
  messages: ChatMessage[],
  onContext?: (context: string) => void
): AsyncGenerator<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    yield 'Please set your OpenRouter API key in Settings to use Ask Albert.';
    return;
  }

  // RAG: search for relevant context based on the last user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  let contextText = '';

  if (lastUserMessage) {
    try {
      const results = await searchProcess(lastUserMessage.content, 8);
      if (results.length > 0) {
        contextText = '\n\n## Relevant Context from Emergency Response Data\n\n' +
          results.map((r, i) =>
            `### ${i + 1}. [${r.type.toUpperCase()}] ${r.title} (${r.sector}, ${r.phase})\n${r.content}`
          ).join('\n\n');
      }

      // Find matching resources with real URLs
      const resources = searchResources(lastUserMessage.content, 8);
      if (resources.length > 0) {
        contextText += '\n\n## Available Resources & Templates (with download links)\n\n' +
          'Use these links when referencing tools, templates, or guidance documents:\n\n' +
          resources.map(r =>
            `- **${r.name}** (${r.sector} › ${r.task}): ${r.url}`
          ).join('\n');
      }

      // Fetch live classification data from Supabase
      try {
        if (!classificationCache) {
          classificationCache = await fetchClassifications();
        }
        if (classificationCache.length > 0) {
          const severityLabel = (s: number) =>
            s >= 3 ? 'Red' : s === 2 ? 'Orange' : 'Yellow';

          // Summary stats
          const total = classificationCache.length;
          const bySeverity = { Red: 0, Orange: 0, Yellow: 0 };
          const byStance: Record<string, number> = {};
          const byCountry: Record<string, number> = {};
          for (const c of classificationCache) {
            const label = severityLabel(c.severity);
            bySeverity[label] = (bySeverity[label] || 0) + 1;
            byStance[c.stance] = (byStance[c.stance] || 0) + 1;
            byCountry[c.country] = (byCountry[c.country] || 0) + 1;
          }

          // Recent classifications (last 10)
          const recent = classificationCache.slice(0, 10);

          contextText += '\n\n## Live Classification Data (from Supabase)\n\n';
          contextText += `**${total} total classifications** — `;
          contextText += `Red: ${bySeverity.Red}, Orange: ${bySeverity.Orange}, Yellow: ${bySeverity.Yellow}\n\n`;
          contextText += `**By stance:** ${Object.entries(byStance).map(([k, v]) => `${k}: ${v}`).join(', ')}\n\n`;
          contextText += `**Countries with classifications:** ${Object.keys(byCountry).length} (${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}: ${v}`).join(', ')})\n\n`;
          // Total affected summary
          const withAffected = classificationCache.filter(c => c.totalAffected && c.totalAffected > 0);
          if (withAffected.length > 0) {
            const totalPeople = withAffected.reduce((sum, c) => sum + (c.totalAffected || 0), 0);
            contextText += `**Affected population data:** ${withAffected.length} classifications have affected population figures, totaling ${totalPeople.toLocaleString()} people affected across all recorded emergencies.\n\n`;
          }

          contextText += '**Recent classifications:**\n';
          for (const c of recent) {
            const affected = c.totalAffected ? ` | ${c.totalAffected.toLocaleString()} affected` : '';
            contextText += `- ${c.date || 'no date'} | ${c.country} | ${c.emergencyName || c.type} | ${severityLabel(c.severity)} (${c.stance})${affected}${c.notes ? ` — ${c.notes.slice(0, 80)}` : ''}\n`;
          }
        }
      } catch (e) {
        console.warn('Classification fetch failed, continuing without:', e);
      }

      if (contextText) {
        onContext?.(contextText);
      }
    } catch (e) {
      console.warn('Search failed, continuing without RAG context:', e);
    }
  }

  const systemMessage = SYSTEM_PROMPT + contextText +
    `\n\n## Response Data Summary\nThis navigator contains ${processData.metadata.totalTasks} tasks across ${processData.metadata.totalSectors} sectors, with ${processData.metadata.totalSubtasks} subtasks. The knowledge base includes ${processData.metadata.totalDownloadedDocs} indexed documents (${processData.metadata.totalResources} resources, ${processData.metadata.totalResourcesWithUrls} with direct links). The AI search draws from ${processData.metadata.totalSearchChunks.toLocaleString()} knowledge chunks.`;

  const model = getModel();

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'IRC Emergency Response Navigator',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemMessage },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      try {
        const parsed = JSON.parse(err);
        const msg = parsed?.error?.message || parsed?.message || err;
        if (response.status === 429) {
          yield `⚠️ Rate limited — this model is temporarily overloaded. Try again in a moment, or switch to a different model in Settings.`;
        } else if (response.status === 401) {
          yield `⚠️ Invalid API key. Please check your OpenRouter key in Settings.`;
        } else if (response.status === 402) {
          yield `⚠️ Insufficient credits. Add credits at openrouter.ai or switch to a free model in Settings.`;
        } else {
          yield `⚠️ Error (${response.status}): ${msg}`;
        }
      } catch {
        yield `⚠️ Error (${response.status}): ${err.slice(0, 200)}`;
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield 'Error: No response stream';
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  } catch (error) {
    yield `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
