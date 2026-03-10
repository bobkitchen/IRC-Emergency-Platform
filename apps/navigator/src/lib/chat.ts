/**
 * Chat via Supabase Edge Function.
 * The Edge Function handles RAG search, system prompt construction,
 * classification data, and OpenRouter streaming — no API key needed on the client.
 */

const SUPABASE_FUNCTION_URL =
  import.meta.env.VITE_SUPABASE_FUNCTION_URL ||
  'https://qykjjfbdvwqxqmsgiebs.supabase.co/functions/v1';

// --- Model definitions (kept for UI display) ---

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

export function getModel(): string {
  const stored = localStorage.getItem('irc_openrouter_model')
    || localStorage.getItem('ern-model');
  if (stored && MODELS.some(m => m.id === stored)) return stored;
  return DEFAULT_MODEL;
}

export function setModel(model: string) {
  localStorage.setItem('irc_openrouter_model', model);
}

// --- Streaming chat via Edge Function ---

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamChat(
  messages: ChatMessage[],
  site: 'navigator' | 'classification' | 'crf' = 'navigator',
): AsyncGenerator<string> {
  const model = getModel();

  try {
    const response = await fetch(`${SUPABASE_FUNCTION_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        site,
        model,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      try {
        const parsed = JSON.parse(err);
        const msg = parsed?.error || err;
        if (response.status === 429) {
          yield '⚠️ Rate limited — too many requests. Try again in a moment.';
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
