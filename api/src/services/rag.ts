// PRD-011: Clinical Knowledge Base & RAG Pipeline
// PRD-032: Semantic RAG — vector cosine similarity via pgvector
//
// Retrieves top-K relevant knowledge chunks for a presenting complaint.
// Primary path: cosine similarity against Bedrock Titan Embed Text V2 embeddings.
// Fallback path: keyword ILIKE text search (used when Bedrock is unavailable,
// e.g. local dev without AWS credentials or unit tests).

import { LRUCache } from "lru-cache";
import { Pool } from "pg";
import { pool as defaultPool } from "../db";
import { logger } from "../logger";
import {
  generateEmbedding,
  formatVectorLiteral,
} from "./embeddingService";

// ---------------------------------------------------------------------------
// LRU cache for RAG retrieval results (F-068, F-069, PRD-032 F-008)
// Keyed on presenting complaint text + condition + topK.
// 200 entries, 1 hour TTL.
// ---------------------------------------------------------------------------
const ragCache = new LRUCache<string, RagRetrievalResult>({
  max: 200,
  ttl: 60 * 60 * 1000,
});

function cacheKey(query: string, condition?: string, topK?: number): string {
  return [query.trim().toLowerCase(), condition ?? "", String(topK ?? 5)].join("|");
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
  retrievalMethod: "vector" | "keyword_fallback";
  topSimilarity?: number;
  consultationId?: string;
}

// ---------------------------------------------------------------------------
// Stop words used by the keyword fallback path
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
// Used only by the keyword fallback path.
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
// vectorRetrieve (internal)
// Queries by cosine similarity. Only returns chunks with similarity >= threshold.
// Chunks ordered closest-first (lowest cosine distance = highest similarity).
// ---------------------------------------------------------------------------
const SIMILARITY_THRESHOLD = 0.5;

interface VectorRow extends KnowledgeChunk {
  similarity: number;
}

async function vectorRetrieve(
  embedding: number[],
  options: { topK: number; condition?: string },
  dbPool: Pool
): Promise<{ chunks: KnowledgeChunk[]; topSimilarity: number }> {
  const vectorLiteral = formatVectorLiteral(embedding);
  const params: unknown[] = [vectorLiteral, SIMILARITY_THRESHOLD, options.topK];

  const conditionClause = options.condition
    ? `AND condition = $${params.length + 1}`
    : "";
  if (options.condition) params.push(options.condition);

  const sql = `
    SELECT
      id,
      source_name            AS "sourceName",
      category,
      condition,
      chunk_text             AS "chunkText",
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> $1::vector) >= $2
    ${conditionClause}
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `;

  const { rows } = await dbPool.query<VectorRow>(sql, params);

  const chunks: KnowledgeChunk[] = rows.map(({ similarity: _s, ...chunk }) => chunk);
  const topSimilarity = rows.length > 0 ? rows[0].similarity : 0;

  return { chunks, topSimilarity };
}

// ---------------------------------------------------------------------------
// keywordRetrieve (internal)
// ILIKE fallback — used when embedding generation fails.
// ---------------------------------------------------------------------------
async function keywordRetrieve(
  keywords: string[],
  options: { topK: number; condition?: string },
  dbPool: Pool
): Promise<KnowledgeChunk[]> {
  if (keywords.length === 0) return [];

  const paramOffset = options.condition ? 2 : 1;
  const ilikeConditions = keywords
    .map((_, i) => `chunk_text ILIKE $${paramOffset + i}`)
    .join(" OR ");

  const params: unknown[] = [];
  if (options.condition) params.push(options.condition);
  params.push(...keywords.map((k) => `%${k}%`));
  params.push(options.topK);

  const limitParam = `$${params.length}`;
  const conditionClause = options.condition ? `AND condition = $1` : "";

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
  return rows;
}

// ---------------------------------------------------------------------------
// retrieve
// Given presenting complaint text, returns top-K relevant chunks.
// Tries vector cosine similarity first; falls back to keyword search on error.
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

  const key = cacheKey(presentingComplaint, condition, topK);
  const cached = ragCache.get(key);

  if (cached !== undefined) {
    logger.debug({ cacheKey: key, hit: true }, "rag.retrieve: cache hit");
    await writeAuditLog(dbPool, cached, consultationId, true);
    return { ...cached, consultationId };
  }

  logger.debug({ cacheKey: key, hit: false }, "rag.retrieve: cache miss");

  let result: RagRetrievalResult;
  const keywords = extractKeywords(presentingComplaint);

  try {
    const embedding = await generateEmbedding(presentingComplaint);
    const { chunks, topSimilarity } = await vectorRetrieve(
      embedding,
      { topK, condition },
      dbPool
    );
    result = {
      chunks,
      queryKeywords: keywords,
      retrievalMethod: "vector",
      topSimilarity,
    };
  } catch (err) {
    logger.warn(
      { err },
      "rag.retrieve: embedding generation failed, falling back to keyword search"
    );
    const chunks = await keywordRetrieve(keywords, { topK, condition }, dbPool);
    result = {
      chunks,
      queryKeywords: keywords,
      retrievalMethod: "keyword_fallback",
    };
  }

  ragCache.set(key, result);
  await writeAuditLog(dbPool, result, consultationId, false);

  return { ...result, consultationId };
}

// ---------------------------------------------------------------------------
// writeAuditLog (internal)
// ---------------------------------------------------------------------------
async function writeAuditLog(
  dbPool: Pool,
  result: RagRetrievalResult,
  consultationId: string | undefined,
  cacheHit: boolean
): Promise<void> {
  try {
    const metadata: Record<string, unknown> = {
      query_keywords: result.queryKeywords,
      chunk_ids: result.chunks.map((c) => c.id),
      consultation_id: consultationId ?? null,
      retrieval_method: result.retrievalMethod,
      cache_hit: cacheHit,
    };
    if (result.retrievalMethod === "vector" && result.topSimilarity !== undefined) {
      metadata.top_similarity = result.topSimilarity;
    }

    await dbPool.query(
      `INSERT INTO audit_log
         (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES
         ('rag.retrieval_performed', $1, 'system', $2, $3)`,
      [
        "00000000-0000-0000-0000-000000000000",
        consultationId ?? null,
        JSON.stringify(metadata),
      ]
    );
  } catch (err) {
    logger.error({ err }, "rag.retrieve: failed to write audit log");
  }
}

// ---------------------------------------------------------------------------
// ingestChunk
// Inserts a knowledge chunk. Caller is responsible for generating and
// passing the embedding (see ingest-knowledge-base.ts / generate-embeddings.ts).
// ---------------------------------------------------------------------------
export async function ingestChunk(
  chunk: Omit<KnowledgeChunk, "id">,
  embedding: number[] | null,
  dbPool: Pool = defaultPool
): Promise<string> {
  const { rows } = await dbPool.query<{ id: string }>(
    `INSERT INTO knowledge_chunks
       (source_name, category, condition, chunk_text, metadata, embedding)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      chunk.sourceName,
      chunk.category,
      chunk.condition ?? null,
      chunk.chunkText,
      JSON.stringify(chunk.metadata ?? {}),
      embedding ? formatVectorLiteral(embedding) : null,
    ]
  );
  return rows[0].id;
}
