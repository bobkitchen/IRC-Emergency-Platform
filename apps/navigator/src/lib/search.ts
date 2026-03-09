import { create, insert, search as oramaSearch } from '@orama/orama';
import type { SearchChunk } from '@/types';
import searchChunksData from '@/data/search-chunks.json';

const chunks = searchChunksData as SearchChunk[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

export async function getSearchDb() {
  if (db) return db;

  db = await create({
    schema: {
      id: 'string',
      type: 'string',
      sector: 'string',
      sectorId: 'string',
      phase: 'string',
      title: 'string',
      content: 'string',
      priority: 'string',
    } as const,
  });

  for (const chunk of chunks) {
    await insert(db, {
      id: chunk.id,
      type: chunk.type,
      sector: chunk.sector,
      sectorId: chunk.sectorId,
      phase: chunk.phase,
      title: chunk.title,
      content: chunk.content,
      priority: chunk.priority,
    });
  }

  return db;
}

export async function searchProcess(query: string, limit = 10) {
  const database = await getSearchDb();
  const results = await oramaSearch(database, {
    term: query,
    limit,
    boost: {
      title: 2,
      content: 1,
    },
  });

  return results.hits.map((hit: any) => ({
    id: hit.document.id as string,
    title: hit.document.title as string,
    content: hit.document.content as string,
    sector: hit.document.sector as string,
    sectorId: hit.document.sectorId as string,
    phase: hit.document.phase as string,
    type: hit.document.type as string,
    score: hit.score,
  }));
}
