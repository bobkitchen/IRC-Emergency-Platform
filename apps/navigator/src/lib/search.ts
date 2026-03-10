/**
 * Search via Supabase Edge Function (hybrid vector + FTS).
 * Replaces the previous client-side Orama BM25 search.
 */

const SUPABASE_FUNCTION_URL =
  import.meta.env.VITE_SUPABASE_FUNCTION_URL ||
  'https://qykjjfbdvwqxqmsgiebs.supabase.co/functions/v1';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  sector: string;
  sector_id: string;
  phase: string;
  type: string;
  priority: string;
  similarity: number;
}

interface ResourceResult {
  id: number;
  name: string;
  url: string;
  sector: string;
  task: string;
  similarity: number;
}

export interface SearchResponse {
  chunks: SearchResult[];
  resources: ResourceResult[];
}

export async function searchProcess(query: string, limit = 10): Promise<SearchResult[]> {
  const response = await fetch(`${SUPABASE_FUNCTION_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    console.warn('Search failed:', response.status);
    return [];
  }

  const data: SearchResponse = await response.json();
  return data.chunks.map(c => ({
    ...c,
    sectorId: c.sector_id,
    score: c.similarity,
  }));
}

export async function searchAll(query: string, limit = 10): Promise<SearchResponse> {
  const response = await fetch(`${SUPABASE_FUNCTION_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    console.warn('Search failed:', response.status);
    return { chunks: [], resources: [] };
  }

  return response.json();
}
