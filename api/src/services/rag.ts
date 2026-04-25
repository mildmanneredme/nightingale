// PRD-011: Clinical Knowledge Base & RAG Pipeline
// Retrieves top-K relevant knowledge chunks for a presenting complaint.
// Embedding generation deferred to actual model integration (Bedrock/OpenAI).
// At MVP, falls back to keyword (ILIKE text search) since pgvector extension
// requires superuser to enable and is not available in test environment.

import { LRUCache } from "lru-cache";
import { Pool } from "pg";
import { pool as defaultPool } from "../db";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// LRU cache for RAG retrieval results (F-068, F-069)
// Keyed on sorted, comma-joined keyword set; max 200 entries; 1 hour TTL.
// ---------------------------------------------------------------------------
const ragCache = new LRUCache<string, KnowledgeChunk[]>({
  max: 200,
  ttl: 60 * 60 * 1000, // 1 hour
});

function cacheKey(keywords: string[]): string {
  return [...keywords].sort().join(",");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeChunk {
  id: string;
  sourceName: string;
  category: string;
  condition: string | null;
  chunkText: string;
  metadata: Record<string, unknown>;
}

export interface RagRetrievalResult {
  chunks: KnowledgeChunk[];
  queryKeywords: string[];
  consultationId?: string;
}

// ---------------------------------------------------------------------------
// Stop words to filter from keyword extraction
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "its", "i", "my", "me", "we",
  "our", "you", "your", "he", "she", "his", "her", "they", "their",
  "this", "that", "these", "those", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "am", "are", "not", "no", "so", "if", "as",
  "up", "out", "about", "after", "before", "since", "than", "then", "when",
  "also", "more", "some", "any", "all", "one", "two", "can", "just",
]);

// ---------------------------------------------------------------------------
// extractKeywords
// Simple keyword extraction from presenting complaint text.
// Strips punctuation, lowercases, removes stop words, filters short tokens.
// ---------------------------------------------------------------------------
export function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ""))
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

// ---------------------------------------------------------------------------
// normaliseTerm
// Looks up a clinical term in snomed_terms (case-insensitive match on
// preferred_term). Returns preferred_term if found, otherwise original term.
// ---------------------------------------------------------------------------
export async function normaliseTerm(
  term: string,
  dbPool: Pool = defaultPool
): Promise<string> {
  try {
    const { rows } = await dbPool.query<{ preferred_term: string }>(
      `SELECT preferred_term
       FROM snomed_terms
       WHERE lower(preferred_term) = lower($1)
          OR lower(fsn) LIKE lower($1) || '%'
       LIMIT 1`,
      [term]
    );

    if (rows.length > 0) {
      return rows[0].preferred_term;
    }
    return term;
  } catch (err) {
    logger.warn({ err, term }, "normaliseTerm: DB lookup failed, returning original");
    return term;
  }
}

// ---------------------------------------------------------------------------
// retrieve
// Given presenting complaint text, returns top-K relevant chunks.
// Uses ILIKE keyword text search (pgvector cosine similarity deferred until
// embeddings are generated and the vector extension is enabled on RDS).
// ---------------------------------------------------------------------------
export async function retrieve(
  presentingComplaint: string,
  options: {
    topK?: number;
    condition?: string;
    consultationId?: string;
  } = {},
  dbPool: Pool = defaultPool
): Promise<RagRetrievalResult> {
  const { topK = 5, condition, consultationId } = options;
  const keywords = extractKeywords(presentingComplaint);

  // F-068/F-069/F-070: LRU cache keyed on sorted keyword set
  const key = cacheKey(keywords);
  const cached = ragCache.get(key);

  if (cached !== undefined) {
    logger.debug({ cacheKey: key, hit: true }, "rag.retrieve: cache hit");
    // Write audit log for cache hits with cache_hit: true for observability
    try {
      const chunkIds = cached.map((c) => c.id);
      await dbPool.query(
        `INSERT INTO audit_log
           (event_type, actor_id, actor_role, consultation_id, metadata)
         VALUES
           ('rag.retrieval_performed', $1, 'system', $2, $3)`,
        [
          "00000000-0000-0000-0000-000000000000",
          consultationId ?? null,
          JSON.stringify({
            query_keywords: keywords,
            chunk_ids: chunkIds,
            consultation_id: consultationId ?? null,
            presenting_complaint: presentingComplaint,
            cache_hit: true,
          }),
        ]
      );
    } catch (err) {
      logger.error({ err }, "rag.retrieve: failed to write audit log (cache hit)");
    }
    return {
      chunks: cached,
      queryKeywords: keywords,
      ...(consultationId !== undefined && { consultationId }),
    };
  }

  logger.debug({ cacheKey: key, hit: false }, "rag.retrieve: cache miss");

  let chunks: KnowledgeChunk[] = [];

  if (keywords.length > 0) {
    // Build ILIKE conditions for each keyword — OR across all keywords
    // so we get any chunk that mentions any keyword
    const paramOffset = condition ? 2 : 1;
    const ilikeConditions = keywords
      .map((_, i) => `chunk_text ILIKE $${paramOffset + i}`)
      .join(" OR ");

    const params: unknown[] = [];
    if (condition) {
      params.push(condition);
    }
    params.push(...keywords.map((k) => `%${k}%`));
    params.push(topK);

    const limitParam = `$${params.length}`;

    const conditionClause = condition ? `AND condition = $1` : "";

    const sql = `
      SELECT
        id,
        source_name   AS "sourceName",
        category,
        condition,
        chunk_text    AS "chunkText",
        metadata
      FROM knowledge_chunks
      WHERE (${ilikeConditions})
      ${conditionClause}
      ORDER BY created_at ASC
      LIMIT ${limitParam}
    `;

    const { rows } = await dbPool.query<KnowledgeChunk>(sql, params);
    chunks = rows;
  }

  // Store result in cache (including empty-keyword case — empty array is valid)
  ragCache.set(key, chunks);

  // Write audit log
  try {
    const chunkIds = chunks.map((c) => c.id);
    await dbPool.query(
      `INSERT INTO audit_log
         (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES
         ('rag.retrieval_performed', $1, 'system', $2, $3)`,
      [
        // System actor — use a fixed system UUID as actor
        "00000000-0000-0000-0000-000000000000",
        consultationId ?? null,
        JSON.stringify({
          query_keywords: keywords,
          chunk_ids: chunkIds,
          consultation_id: consultationId ?? null,
          presenting_complaint: presentingComplaint,
        }),
      ]
    );
  } catch (err) {
    // Audit log failures are non-fatal — log but don't throw
    logger.error({ err }, "rag.retrieve: failed to write audit log");
  }

  return {
    chunks,
    queryKeywords: keywords,
    ...(consultationId !== undefined && { consultationId }),
  };
}

// ---------------------------------------------------------------------------
// ingestChunk
// Inserts a knowledge chunk (embedding generated separately by indexing job).
// Returns the UUID of the inserted row.
// ---------------------------------------------------------------------------
export async function ingestChunk(
  chunk: Omit<KnowledgeChunk, "id">,
  dbPool: Pool = defaultPool
): Promise<string> {
  const { rows } = await dbPool.query<{ id: string }>(
    `INSERT INTO knowledge_chunks
       (source_name, category, condition, chunk_text, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      chunk.sourceName,
      chunk.category,
      chunk.condition ?? null,
      chunk.chunkText,
      JSON.stringify(chunk.metadata ?? {}),
    ]
  );
  return rows[0].id;
}
