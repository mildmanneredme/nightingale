#!/usr/bin/env tsx
// PRD-032: Semantic RAG Pipeline — embedding backfill script
//
// Generates and stores Bedrock Titan Embed Text V2 embeddings for all
// knowledge_chunks rows where embedding IS NULL.
//
// Run after migration 019 to backfill existing chunks, or after any
// ingest run where Bedrock was unavailable.
//
// Usage:
//   npx tsx api/scripts/generate-embeddings.ts
//
// Options (env vars):
//   BATCH_SIZE     — rows processed per DB round-trip (default: 20)
//   DRY_RUN=true   — log what would be updated without writing to DB
//
// Requires DB env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
// or DATABASE_URL. Requires AWS credentials with bedrock:InvokeModel on
// amazon.titan-embed-text-v2:0 in ap-southeast-2.

import { Pool } from "pg";
import { generateEmbedding, formatVectorLiteral } from "../src/services/embeddingService";

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "20", 10);
const DRY_RUN = process.env.DRY_RUN === "true";

interface ChunkRow {
  id: string;
  chunk_text: string;
  source_name: string;
  condition: string | null;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const dbPool = dbUrl
    ? new Pool({ connectionString: dbUrl })
    : new Pool({
        host: process.env.DB_HOST ?? "localhost",
        port: parseInt(process.env.DB_PORT ?? "5432", 10),
        database: process.env.DB_NAME ?? "nightingale",
        user: process.env.DB_USER ?? "nightingale_admin",
        password: process.env.DB_PASSWORD ?? "",
      });

  if (DRY_RUN) {
    console.log("DRY RUN — no writes will be made.\n");
  }

  const { rows: countRows } = await dbPool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM knowledge_chunks WHERE embedding IS NULL`
  );
  const total = parseInt(countRows[0].count, 10);
  console.log(`Chunks needing embeddings: ${total}`);

  if (total === 0) {
    console.log("Nothing to do.");
    await dbPool.end();
    return;
  }

  let offset = 0;
  let processed = 0;
  let failed = 0;

  while (offset < total) {
    const { rows } = await dbPool.query<ChunkRow>(
      `SELECT id, chunk_text, source_name, condition
       FROM knowledge_chunks
       WHERE embedding IS NULL
       ORDER BY created_at ASC
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (rows.length === 0) break;

    for (const row of rows) {
      const label = `[${row.source_name}${row.condition ? `/${row.condition}` : ""}] ${row.id.slice(0, 8)}`;
      try {
        const embedding = await generateEmbedding(row.chunk_text);

        if (!DRY_RUN) {
          await dbPool.query(
            `UPDATE knowledge_chunks SET embedding = $1 WHERE id = $2`,
            [formatVectorLiteral(embedding), row.id]
          );
        }

        processed++;
        console.log(`  [${processed}/${total}] OK   ${label}`);
      } catch (err) {
        failed++;
        console.error(`  [${processed + failed}/${total}] FAIL ${label}: ${err}`);
      }
    }

    offset += rows.length;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Done. Processed: ${processed}, Failed: ${failed}`);
  if (failed > 0) {
    console.log("Re-run the script to retry failed chunks.");
  }

  await dbPool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("generate-embeddings failed:", err);
  process.exit(1);
});
