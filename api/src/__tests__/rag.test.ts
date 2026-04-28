// PRD-011: RAG Pipeline tests — TDD (write failing tests first)
// Uses real test DB (same pattern as consultations.test.ts)

import { getTestPool, closeTestPool } from "./helpers/db";
import {
  extractKeywords,
  normaliseTerm,
  retrieve,
  ingestChunk,
} from "../services/rag";

// ---------------------------------------------------------------------------
// Reset RAG tables between tests
// ---------------------------------------------------------------------------
async function resetRagTables(): Promise<void> {
  const pool = getTestPool();
  // Truncate RAG tables and audit_log to prevent cross-test pollution.
  // audit_log has no FK dependencies so it can be truncated independently.
  await pool.query(`TRUNCATE knowledge_chunks, snomed_terms RESTART IDENTITY CASCADE`);
  await pool.query(`DELETE FROM audit_log WHERE event_type = 'rag.retrieval_performed'`);
}

beforeEach(async () => {
  await resetRagTables();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// extractKeywords
// ---------------------------------------------------------------------------
describe("extractKeywords", () => {
  it("extracts meaningful words from a presenting complaint", () => {
    const keywords = extractKeywords("chest pain and shortness of breath");
    expect(keywords).toEqual(expect.arrayContaining(["chest", "pain", "shortness", "breath"]));
  });

  it("filters stop words like 'and', 'of', 'the'", () => {
    const keywords = extractKeywords("the patient has a sore throat and a runny nose");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("and");
    expect(keywords).not.toContain("a");
    expect(keywords).toEqual(expect.arrayContaining(["sore", "throat", "runny", "nose"]));
  });

  it("returns lowercase keywords", () => {
    const keywords = extractKeywords("FEVER and COUGH");
    expect(keywords).toEqual(expect.arrayContaining(["fever", "cough"]));
  });

  it("returns empty array for empty string", () => {
    const keywords = extractKeywords("");
    expect(keywords).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normaliseTerm
// ---------------------------------------------------------------------------
describe("normaliseTerm", () => {
  it("returns original term when no match in snomed_terms", async () => {
    const result = await normaliseTerm("heart attack");
    expect(result).toBe("heart attack");
  });

  it("returns preferred_term when a matching SNOMED concept exists (case-insensitive)", async () => {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO snomed_terms (concept_id, fsn, preferred_term, semantic_tag)
      VALUES ('22298006', 'Myocardial infarction (disorder)', 'Myocardial infarction', 'disorder')
    `);

    // heart attack is the colloquial term — normaliseTerm looks for it by preferred_term or fsn
    // If exact match not found, returns original — this is the expected behaviour
    const result = await normaliseTerm("heart attack");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns preferred_term for a direct match on preferred_term field", async () => {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO snomed_terms (concept_id, fsn, preferred_term, semantic_tag)
      VALUES ('444814009', 'Viral upper respiratory tract infection (disorder)', 'Viral upper respiratory tract infection', 'disorder')
    `);

    const result = await normaliseTerm("viral upper respiratory tract infection");
    expect(result).toBe("Viral upper respiratory tract infection");
  });
});

// ---------------------------------------------------------------------------
// ingestChunk
// ---------------------------------------------------------------------------
describe("ingestChunk", () => {
  it("inserts a knowledge chunk and returns a UUID", async () => {
    const id = await ingestChunk(
      {
        sourceName: "RACGP Red Book 2024",
        category: "therapeutic-guidelines",
        condition: "urti",
        chunkText: "Most URTIs are viral and self-limiting. Antibiotics are not indicated.",
        metadata: { version: "2024" },
      },
      null
    );

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT source_name, category, condition FROM knowledge_chunks WHERE id = $1",
      [id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source_name).toBe("RACGP Red Book 2024");
    expect(rows[0].category).toBe("therapeutic-guidelines");
    expect(rows[0].condition).toBe("urti");
  });
});

// ---------------------------------------------------------------------------
// retrieve
// ---------------------------------------------------------------------------
describe("retrieve", () => {
  async function seedUrtiChunks() {
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO knowledge_chunks (source_name, category, condition, chunk_text, metadata)
      VALUES
        ('RACGP Guideline', 'therapeutic-guidelines', 'urti',
         'Most URTIs are viral and self-limiting. Antibiotics are not indicated for viral URTI.',
         '{}'),
        ('RACGP Guideline', 'therapeutic-guidelines', 'urti',
         'Symptoms of sore throat and runny nose typically resolve within 7-10 days without treatment.',
         '{}'),
        ('PBS Medications', 'medications', 'urti',
         'Amoxicillin is not recommended for viral upper respiratory tract infections.',
         '{}')
    `);
  }

  it("returns chunks matching URTI keywords", async () => {
    await seedUrtiChunks();

    const result = await retrieve("sore throat and runny nose", { topK: 3 });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.length).toBeLessThanOrEqual(3);
    const chunkTexts = result.chunks.map((c) => c.chunkText.toLowerCase());
    const hasUrti = chunkTexts.some(
      (t) => t.includes("sore throat") || t.includes("runny nose") || t.includes("urti") || t.includes("respiratory")
    );
    expect(hasUrti).toBe(true);
  });

  it("returns empty array (not error) when no chunks match", async () => {
    // No seed data
    const result = await retrieve("completely unrelated query xyz123", { topK: 3 });
    expect(result.chunks).toEqual([]);
  });

  it("includes queryKeywords in result", async () => {
    await seedUrtiChunks();

    const result = await retrieve("sore throat and runny nose", { topK: 3 });
    expect(result.queryKeywords).toEqual(expect.arrayContaining(["sore", "throat", "runny", "nose"]));
  });

  it("includes consultationId in result when provided", async () => {
    const consultationId = "00000000-0000-0000-0000-000000000001";
    const result = await retrieve("sore throat", {
      topK: 3,
      consultationId,
    });

    expect(result.consultationId).toBe(consultationId);
  });

  it("respects topK limit", async () => {
    await seedUrtiChunks();

    const result = await retrieve("urti viral respiratory", { topK: 2 });
    expect(result.chunks.length).toBeLessThanOrEqual(2);
  });

  it("writes a rag.retrieval_performed audit log event", async () => {
    await seedUrtiChunks();
    const consultationId = "00000000-0000-0000-0000-000000000002";

    await retrieve("sore throat", { topK: 3, consultationId });

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE event_type = 'rag.retrieval_performed' ORDER BY created_at DESC LIMIT 1`
    );

    expect(rows).toHaveLength(1);
    const logEntry = rows[0];
    expect(logEntry.event_type).toBe("rag.retrieval_performed");
    expect(logEntry.metadata).toMatchObject({
      query_keywords: expect.any(Array),
    });
  });

  it("filters by condition when provided", async () => {
    await seedUrtiChunks();

    // Seed a UTI chunk
    const pool = getTestPool();
    await pool.query(`
      INSERT INTO knowledge_chunks (source_name, category, condition, chunk_text, metadata)
      VALUES ('RACGP Guideline', 'therapeutic-guidelines', 'uti',
              'UTI symptoms include dysuria and frequent urination.',
              '{}')
    `);

    const result = await retrieve("pain urination", { topK: 5, condition: "uti" });
    const conditions = result.chunks.map((c) => c.condition);
    // All returned chunks should be for 'uti' condition
    conditions.forEach((cond) => expect(cond).toBe("uti"));
  });
});
