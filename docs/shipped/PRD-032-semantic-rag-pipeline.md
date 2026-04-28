# PRD-032 — Semantic RAG Pipeline (Vector Embeddings)

> **Status:** Shipped 2026-04-28
> **Phase:** Sprint 10
> **Type:** Internal
> **Owner:** CTO

---

## Overview

The current RAG retrieval in `api/src/services/rag.ts` uses case-insensitive keyword (`ILIKE`) text search with no semantic understanding, no relevance ranking, and no similarity threshold. Clinical quality benchmarking (PRD-031) confirmed that the knowledge base is contributing negligible signal — the AI engine's outputs are driven almost entirely by Claude's base weights, not retrieved guidelines.

This PRD replaces the keyword search with vector cosine similarity using AWS Bedrock Titan Embed Text V2 (`amazon.titan-embed-text-v2:0`), keeping all embedding computation and storage within `ap-southeast-2` to satisfy AU data residency. A keyword search fallback is retained for environments where the Bedrock embedding call is unavailable (e.g., unit tests without AWS credentials).

---

## Background

**Why RAG is currently broken:** `rag.ts` builds `chunk_text ILIKE %keyword%` OR conditions from a stop-word-filtered keyword list. If the clinical guideline says "upper respiratory tract infection" but the presenting complaint is "sore throat and runny nose", there is no match. Chunks are returned in insertion order — not by relevance. There is no similarity threshold, so unrelated chunks are returned whenever any keyword accidentally appears.

**Scope of knowledge base:** 176 markdown files, split by `## heading` sections (~300–2000 words per chunk). Chunking strategy is not changed in this PRD — that is a separate concern requiring Medical Director review of chunk boundaries.

**Embedding column:** The `knowledge_chunks.embedding` column was provisioned as `TEXT` in migration 006 with a comment noting it would be cast to `vector(1536)` once pgvector was available. This PRD activates that column.

**Data residency:** The presenting complaint passed to `ragRetrieve()` is taken from `consult.presenting_complaint` and may contain patient PII. Titan Embed via Bedrock ap-southeast-2 processes text without data leaving AU infrastructure, satisfying the Privacy Act 1988 and platform data residency policy.

---

## User Roles & Access

No user-visible behaviour change. The improvement is internal to the clinical AI engine — doctors see better-grounded SOAP notes and differentials as a consequence of more relevant guideline retrieval.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| F-001 | System must generate a 1024-dimension embedding for every knowledge chunk at ingest time using `amazon.titan-embed-text-v2:0` via Bedrock in ap-southeast-2. |
| F-002 | System must store embeddings as `vector(1024)` in `knowledge_chunks.embedding` using the pgvector extension. |
| F-003 | `retrieve()` must query by cosine similarity (`<=>` operator) and return only chunks with similarity ≥ 0.5. |
| F-004 | `retrieve()` must return chunks ordered by descending similarity (closest first). |
| F-005 | `retrieve()` must fall back to the existing keyword ILIKE search when the query embedding cannot be generated (Bedrock unavailable, no credentials) and log a warning. |
| F-006 | A standalone backfill script (`api/scripts/generate-embeddings.ts`) must generate and store embeddings for all existing knowledge chunks that have `embedding IS NULL`. |
| F-007 | The ingestion script (`api/scripts/ingest-knowledge-base.ts`) must generate and store embeddings for newly ingested chunks. |
| F-008 | The LRU cache in `rag.ts` must key on presenting complaint text + condition + topK (not keyword set), since semantic queries are no longer keyword-decomposed. |
| F-009 | The audit log entry for `rag.retrieval_performed` must include a `retrieval_method` field (`"vector"` or `"keyword_fallback"`) and, for vector retrievals, the top-1 similarity score. |
| F-010 | The benchmark script (`api/scripts/benchmark-llm-models.ts`) must support a `ragEnabled` boolean per run, allowing back-to-back comparison of scores with and without RAG context injection. |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Data residency | All embedding generation via Bedrock `ap-southeast-2`. Presenting complaint text never sent to a non-AU endpoint. |
| Latency | Embedding generation for a single presenting complaint must complete in < 2 s under normal network conditions (Titan Embed V2 p99 ~300 ms on Bedrock). |
| Availability | If Bedrock is unavailable, RAG falls back to keyword search within 100 ms (no circuit-breaker overhead). |
| Storage | 1024-dimension float32 embedding = 4 KB per chunk. At 5 000 chunks that is ~20 MB; well within RDS free storage tier. |
| Audit | `rag.retrieval_performed` audit log events must include `retrieval_method` to support post-hoc quality analysis. |
| Encryption at rest | pgvector column is stored in RDS, covered by the existing KMS CMK. No additional encryption work required. |

---

## Compliance Notes

The presenting complaint may contain patient PII (name, DOB, Medicare number). Titan Embed Text V2 via Bedrock ap-southeast-2 satisfies:
- **Privacy Act 1988 / APP 8** — data does not leave AU.
- **Platform data residency policy** — all processing in `ap-southeast-2`.

The knowledge base itself contains no patient data. No new personal data is introduced by this PRD.

No AHPRA advertising constraints apply. No patient-facing copy is changed.

---

## Acceptance Criteria

- [ ] `npm run migrate` in `api/` runs migration 019 without error on a clean schema.
- [ ] `knowledge_chunks.embedding` column is of type `vector(1024)` after migration.
- [ ] `pgvector` extension is enabled (query `SELECT * FROM pg_extension WHERE extname = 'vector'` returns a row).
- [ ] Running `api/scripts/generate-embeddings.ts` against a seeded DB populates `embedding` for all chunks with `embedding IS NULL`.
- [ ] `retrieve()` with a valid presenting complaint executes a `<=>` cosine distance query (verify via `EXPLAIN` or audit log `retrieval_method = "vector"`).
- [ ] `retrieve()` returns chunks ordered by similarity score descending.
- [ ] No chunk with similarity < 0.5 appears in results.
- [ ] When Bedrock credentials are absent (env var `AWS_ACCESS_KEY_ID` unset), `retrieve()` logs a warning and returns results via keyword fallback without throwing.
- [ ] Audit log entry for each retrieval includes `retrieval_method` field.
- [ ] Benchmark script output includes two rows per model: `ragEnabled: true` and `ragEnabled: false`, with overall scores comparable.
- [ ] `npm run typecheck` passes in `api/`.
- [ ] Existing RAG unit tests pass.

---

## Dependencies

- PRD-011 (Clinical Knowledge Base & RAG Pipeline) — shipped. Extends the schema and service from that PRD.
- PRD-031 (LLM Benchmarking Framework) — shipped. Benchmark script extended here.

---

## Out of Scope

- Hybrid retrieval (BM25 keyword + vector combined scores). Can be added if vector-only recall proves insufficient.
- Cross-encoder reranking of retrieved chunks. Adds ~200 ms latency; defer until recall metrics justify it.
- Re-chunking the knowledge base by fixed token windows. Requires Medical Director review of chunk boundary changes; separate PRD.
- SNOMED normalisation of the query before embedding. `normaliseTerm()` already exists in `rag.ts`; wiring it into the embedding path is a separate sprint task.
- Fine-tuning any LLM on annotated consultation data. Requires GP annotation dataset not yet assembled.
- Changing the embedding model from Titan Embed Text V2. Evaluated Cohere Embed v3 (also on Bedrock ap-southeast-2); Titan is preferred because it has no per-request data processing agreement (uses standard Bedrock DPA already in place).
