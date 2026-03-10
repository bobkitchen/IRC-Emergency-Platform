/**
 * Ingestion script: Reads search-chunks.json, box-chunks.json, and resource-index.json,
 * generates embeddings via OpenAI text-embedding-3-small, and upserts into Supabase.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=... npx tsx scripts/ingest-to-supabase.ts
 *
 * Or set env vars in a .env file and use dotenv.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Config ──────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qykjjfbdvwqxqmsgiebs.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 50; // embeddings per batch (smaller to avoid TPM limits)
const UPSERT_BATCH = 50; // rows per Supabase upsert

// ── Types ───────────────────────────────────────────────────────────
interface SearchChunk {
  id: string;
  type: string;
  sector: string;
  sectorId: string;
  phase: string;
  title: string;
  content: string;
  classification?: string[];
  officeType?: string;
  priority?: string;
}

interface BoxChunk {
  id: string;
  type: string;
  sector: string;
  sectorId: string;
  phase: string;
  title: string;
  content: string;
  priority?: string;
  source?: string;
}

interface Resource {
  name: string;
  url: string;
  sector: string;
  task: string;
}

// ── Load data ───────────────────────────────────────────────────────
const dataDir = resolve(__dirname, '../apps/navigator/src/data');

function loadJSON<T>(filename: string): T {
  const path = resolve(dataDir, filename);
  console.log(`Loading ${path}...`);
  const raw = readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  console.log(`  → ${Array.isArray(data) ? data.length : 'N/A'} entries`);
  return data;
}

// ── OpenAI embeddings ───────────────────────────────────────────────
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    // Return error info for retry handling
    throw Object.assign(new Error(`OpenAI error ${response.status}: ${err}`), { status: response.status });
  }

  const data = await response.json();
  // Sort by index to maintain order
  const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
  return sorted.map((item: any) => item.embedding);
}

async function getEmbeddingsWithRetry(texts: string[], maxRetries = 3): Promise<number[][]> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getEmbeddings(texts);
    } catch (err: any) {
      if (err.status === 429 && attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 1000 + 500; // 1.5s, 2.5s, 4.5s
        console.log(`    Rate limited, waiting ${wait}ms before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

async function batchEmbed(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} texts)...`);
    const embeddings = await getEmbeddingsWithRetry(batch);
    allEmbeddings.push(...embeddings);

    // Rate limit: 1.5s pause between batches to stay under TPM limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return allEmbeddings;
}

// ── Supabase upsert ─────────────────────────────────────────────────
async function supabaseUpsert(table: string, rows: Record<string, unknown>[], onConflict?: string): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers: Record<string, string> = {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: onConflict
        ? `resolution=merge-duplicates`
        : 'return=minimal',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase upsert error ${response.status}: ${err}`);
    }

    process.stdout.write(`  Upserted ${Math.min(i + UPSERT_BATCH, rows.length)}/${rows.length}\r`);
  }
  console.log();
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ERN RAG Ingestion to Supabase ===\n');

  // 1. Load data files
  const searchChunks = loadJSON<SearchChunk[]>('search-chunks.json');
  const boxChunks = loadJSON<BoxChunk[]>('box-chunks.json');
  const resources = loadJSON<Resource[]>('resource-index.json');

  // 2. Prepare chunks for embedding (prefix box-chunk IDs to avoid collisions)
  const allChunks = [
    ...searchChunks.map(c => ({ ...c, source: 'search-chunks' })),
    ...boxChunks.map(c => ({ ...c, id: `box:${c.id}`, source: 'box-chunks' })),
  ];

  console.log(`\nTotal chunks: ${allChunks.length} (${searchChunks.length} search + ${boxChunks.length} box)`);
  console.log(`Total resources: ${resources.length}`);

  // 3. Generate chunk embeddings
  console.log('\n--- Embedding chunks ---');
  const chunkTexts = allChunks.map(c =>
    `${c.title}\n${c.content}`.slice(0, 8000) // truncate very long content
  );
  const chunkEmbeddings = await batchEmbed(chunkTexts);

  // 4. Generate resource embeddings
  console.log('\n--- Embedding resources ---');
  const resourceTexts = resources.map(r =>
    `${r.name} - ${r.sector} - ${r.task}`
  );
  const resourceEmbeddings = await batchEmbed(resourceTexts);

  // 5. Upsert chunks into Supabase
  console.log('\n--- Upserting chunks ---');
  const chunkRows = allChunks.map((c, i) => ({
    id: c.id,
    type: c.type,
    sector: c.sector || null,
    sector_id: c.sectorId || null,
    phase: c.phase || null,
    title: c.title,
    content: c.content,
    classification: (c as SearchChunk).classification || null,
    office_type: (c as SearchChunk).officeType || null,
    priority: c.priority || null,
    source: c.source,
    embedding: JSON.stringify(chunkEmbeddings[i]),
    updated_at: new Date().toISOString(),
  }));

  await supabaseUpsert('ern_chunks', chunkRows, 'id');

  // 6. Upsert resources into Supabase
  // Resources don't have a natural unique key, so we clear and re-insert
  console.log('\n--- Upserting resources ---');
  // Delete existing resources first
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/ern_resources?id=gt.0`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!delRes.ok) {
    console.warn('Warning: Could not clear existing resources:', await delRes.text());
  }

  const resourceRows = resources.map((r, i) => ({
    name: r.name,
    url: r.url || null,
    sector: r.sector || null,
    task: r.task || null,
    embedding: JSON.stringify(resourceEmbeddings[i]),
  }));

  await supabaseUpsert('ern_resources', resourceRows);

  // 7. Summary
  console.log('\n=== Ingestion complete ===');
  console.log(`Chunks: ${allChunks.length} (${searchChunks.length} search + ${boxChunks.length} box)`);
  console.log(`Resources: ${resources.length}`);

  // Verify counts
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/ern_chunks?select=id&limit=1`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'count=exact',
    },
  });
  const count = countRes.headers.get('content-range');
  console.log(`Supabase ern_chunks count: ${count}`);

  const countRes2 = await fetch(`${SUPABASE_URL}/rest/v1/ern_resources?select=id&limit=1`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'count=exact',
    },
  });
  const count2 = countRes2.headers.get('content-range');
  console.log(`Supabase ern_resources count: ${count2}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
