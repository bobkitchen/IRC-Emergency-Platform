/**
 * Supabase Edge Function: /chat
 * Full RAG pipeline: embed query → hybrid search → build prompt → stream from OpenRouter.
 * Accepts a `site` parameter to inject site-specific focus priorities.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://bobkitchen.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embedding error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── System prompt components ────────────────────────────────────────

const CORE_PROMPT = `You are Albert, the IRC Emergency Response AI Assistant. You have deep knowledge of IRC's Emergency Management Guidelines v2.0 and the complete emergency response process.

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

### CRF Details
- $1M ceiling for Orange, $2M for Red emergencies
- $47.34 per-client cost benchmark
- 14-day deadline for logframe + budget submission
- 10% scale target of affected population
- Early Action: $100K per region earmarked
- Response Plan sections: A (Crisis Context), B (IRC Context), C (Response Strategy), D (10% Scale Target), E (Staffing), F (Partnerships), G (Budget)

## Guidelines
- Always cite specific tasks, phases, or guideline sections when answering
- When discussing tasks, reference task IDs (e.g., RMIE-001, FINANCE-015)
- Explain dependencies and sequencing between tasks
- Tailor advice to the user's classification stance and office type
- Be direct and actionable — responders need clear guidance under pressure
- When you don't know something specific, say so rather than guessing
- When referencing resources or templates, provide clickable markdown links
- Format resource links as: [Resource Name](url)
- Keep responses well-structured with clear headings, bullet points, and short paragraphs`;

const FOCUS_PRIORITIES: Record<string, string> = {
  navigator: `## Your Focus Priority
You are embedded in the Emergency Response Navigator. You cover ALL aspects of emergency response equally — from classification through transition. Help users navigate the full 7-phase lifecycle, find the right tasks for their sector and phase, and understand process requirements.`,

  classification: `## Your Focus Priority
You are embedded in the Emergency Classification System. Prioritize questions about:
- Classification data, severity ratings, stance lookups
- Trends across countries, regions, crisis types
- Reclassification rules and expiration (42-day cycle)
- Complex emergency escalation rules (3 Yellows → Orange, 2 Oranges → Red)
For CRF allocation details, suggest the CRF Calculator's Ask Albert.`,

  crf: `## Your Focus Priority
You are embedded in the CRF Allocation Calculator. Prioritize questions about:
- CRF allocation ceilings ($1M Orange, $2M Red), the $47.34 per-client cost
- CRF request process, response plan requirements (Sections A-G)
- 14-day deadline for logframe + budget submission
- 10% scale target, affected population, and allocation methodology
- Early Action funding ($100K per region earmarked in CRF)
For detailed classification data charts or trends, suggest the Classification app's Ask Albert.`,
};

// ── Fetch live classification data ──────────────────────────────────

async function fetchClassificationContext(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('classifications')
      .select('country, severity, stance, date, emergency_name, type, total_affected, notes')
      .order('date', { ascending: false });

    if (error || !data || data.length === 0) return '';

    const severityLabel = (s: number) => s >= 3 ? 'Red' : s === 2 ? 'Orange' : 'Yellow';
    const total = data.length;
    const bySeverity: Record<string, number> = { Red: 0, Orange: 0, Yellow: 0 };
    const byStance: Record<string, number> = {};
    const byCountry: Record<string, number> = {};

    for (const c of data) {
      const label = severityLabel(c.severity);
      bySeverity[label] = (bySeverity[label] || 0) + 1;
      if (c.stance) byStance[c.stance] = (byStance[c.stance] || 0) + 1;
      if (c.country) byCountry[c.country] = (byCountry[c.country] || 0) + 1;
    }

    const withAffected = data.filter((c: any) => c.total_affected && c.total_affected > 0);
    const totalPeople = withAffected.reduce((sum: number, c: any) => sum + (c.total_affected || 0), 0);

    let ctx = `\n\n## Live Classification Data (from Supabase)\n\n`;
    ctx += `**${total} total classifications** — Red: ${bySeverity.Red}, Orange: ${bySeverity.Orange}, Yellow: ${bySeverity.Yellow}\n\n`;
    ctx += `**By stance:** ${Object.entries(byStance).map(([k, v]) => `${k}: ${v}`).join(', ')}\n\n`;
    ctx += `**Countries with classifications:** ${Object.keys(byCountry).length} (${Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}: ${v}`).join(', ')})\n\n`;

    if (withAffected.length > 0) {
      ctx += `**Affected population data:** ${withAffected.length} classifications, totaling ${totalPeople.toLocaleString()} people affected.\n\n`;
    }

    // Recent 10
    ctx += '**Recent classifications:**\n';
    for (const c of data.slice(0, 10)) {
      const affected = c.total_affected ? ` | ${Number(c.total_affected).toLocaleString()} affected` : '';
      ctx += `- ${c.date || 'no date'} | ${c.country} | ${c.emergency_name || c.type} | ${severityLabel(c.severity)} (${c.stance})${affected}${c.notes ? ` — ${c.notes.slice(0, 80)}` : ''}\n`;
    }

    return ctx;
  } catch (e) {
    console.warn('Classification fetch failed:', e);
    return '';
  }
}

// ── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), {
      status: 429,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    // 1E: Handle feedback submissions
    if (body.feedback) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('chat_feedback').insert({
        message_id: body.feedback.messageId,
        rating: body.feedback.rating,
        query: body.feedback.query,
        site: body.feedback.site || 'navigator',
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const { messages, site = 'navigator', model = 'google/gemini-2.5-flash' } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing "messages" array' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1B: Conversation memory — build composite query from recent messages ──
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    let ragContext = '';

    if (lastUserMsg) {
      try {
        // Use last 3 messages (user + assistant) as context for better RAG retrieval
        const recentMessages = messages.slice(-6); // up to 3 exchanges
        const compositeQuery = recentMessages
          .filter((m: any) => m.role === 'user')
          .map((m: any) => m.content)
          .slice(-3)
          .join(' ');
        const queryForEmbedding = compositeQuery || lastUserMsg.content;

        // ── 1F: Query expansion — expand with domain synonyms ──
        let expandedQuery = queryForEmbedding;
        try {
          const expansionRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              max_tokens: 150,
              messages: [{
                role: 'user',
                content: `Given this IRC emergency response query, output 2-3 related search terms that use IRC/humanitarian domain synonyms. Only output the terms, comma-separated, no explanation.\n\nQuery: "${lastUserMsg.content}"`,
              }],
            }),
          });
          if (expansionRes.ok) {
            const expansionData = await expansionRes.json();
            const expanded = expansionData.choices?.[0]?.message?.content?.trim();
            if (expanded && expanded.length < 300) {
              expandedQuery = `${queryForEmbedding} ${expanded}`;
            }
          }
        } catch { /* continue without expansion */ }

        const embedding = await getEmbedding(expandedQuery);

        // Search chunks
        const { data: chunks } = await supabase.rpc('search_chunks', {
          query_embedding: embedding,
          query_text: lastUserMsg.content,
          match_count: 8,
        });

        if (chunks && chunks.length > 0) {
          ragContext += '\n\n## Relevant Context from Emergency Response Data\n\n';
          ragContext += chunks.map((c: any, i: number) =>
            `### ${i + 1}. [${c.type.toUpperCase()}] ${c.title} (${c.sector}, ${c.phase})\n${c.content}`
          ).join('\n\n');
        }

        // Search resources
        const { data: resources } = await supabase.rpc('search_resources', {
          query_embedding: embedding,
          match_count: 8,
        });

        if (resources && resources.length > 0) {
          ragContext += '\n\n## Available Resources & Templates (with download links)\n\n';
          ragContext += 'Use these links when referencing tools, templates, or guidance documents:\n\n';
          ragContext += resources.map((r: any) =>
            `- **${r.name}** (${r.sector} › ${r.task}): ${r.url}`
          ).join('\n');
        }
      } catch (e) {
        console.warn('RAG search failed, continuing without:', e);
      }
    }

    // Fetch live classification data
    const classificationContext = await fetchClassificationContext(supabase);

    // ── 1G: Append source citation instruction to system prompt ──
    const citationInstruction = `\n\n## Citation Guidelines
- When referencing specific tasks, always use the task ID format (e.g., RMIE-001, FINANCE-015)
- When you mention resources or templates from the context above, always include the full markdown link
- At the end of your response, if you referenced specific documents or tasks, add a "**Sources:**" section listing them`;

    // Build system prompt
    const focusPriority = FOCUS_PRIORITIES[site] || FOCUS_PRIORITIES.navigator;
    const systemPrompt = CORE_PROMPT + '\n\n' + focusPriority + ragContext + classificationContext + citationInstruction;

    // Stream from OpenRouter
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://bobkitchen.github.io',
        'X-Title': `IRC ${site === 'crf' ? 'CRF Calculator' : site === 'classification' ? 'Emergency Classification' : 'Emergency Response Navigator'}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      console.error('OpenRouter error:', orResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI service error (${orResponse.status})` }), {
        status: 502,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Forward SSE stream to client
    return new Response(orResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat error:', err);
    return new Response(JSON.stringify({ error: 'Chat failed' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
