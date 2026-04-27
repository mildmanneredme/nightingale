import request from "supertest";
import { buildAdminApp } from "./helpers/appAdmin";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";
import { recordUsage, computeCostUsdMicros, clearPricingCache } from "../services/llmUsageTracker";

const ADMIN_SUB = "admin-llm-test";
const adminApp = buildAdminApp(ADMIN_SUB);

beforeEach(async () => {
  await resetTestDb();
  clearPricingCache();
});

afterAll(async () => {
  await closeTestPool();
});

describe("computeCostUsdMicros", () => {
  // Sonnet 4.6 list: $3/M input, $15/M output, $0.30/M cache read, $3.75/M cache write.
  const SONNET = {
    input_per_mtok_usd: "3.000000",
    output_per_mtok_usd: "15.000000",
    cache_read_per_mtok_usd: "0.300000",
    cache_write_per_mtok_usd: "3.750000",
  };

  it("computes cost in micros for input + output only", () => {
    // 1000 input @ $3/M = 3000 micros, 500 output @ $15/M = 7500 micros = 10500 micros = $0.0105
    expect(computeCostUsdMicros(1000, 500, 0, 0, SONNET)).toBe(10500);
  });

  it("includes cache read and write tokens", () => {
    // 1000 input + 500 output + 800 cache_read + 200 cache_write
    // = 1000*3 + 500*15 + 800*0.3 + 200*3.75 = 3000 + 7500 + 240 + 750 = 11490
    expect(computeCostUsdMicros(1000, 500, 800, 200, SONNET)).toBe(11490);
  });

  it("treats null cache rates as zero", () => {
    const FLASH = {
      input_per_mtok_usd: "0.300000",
      output_per_mtok_usd: "2.500000",
      cache_read_per_mtok_usd: null,
      cache_write_per_mtok_usd: null,
    };
    // 10000 in @ $0.3/M = 3000 micros, 2000 out @ $2.5/M = 5000 micros = 8000 micros
    expect(computeCostUsdMicros(10000, 2000, 0, 0, FLASH)).toBe(8000);
  });
});

describe("recordUsage", () => {
  it("inserts a row with the computed cost using seeded pricing", async () => {
    const pool = getTestPool();
    await recordUsage({
      consultationId: null,
      operation: "soap_generation",
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      inputTokens: 2000,
      outputTokens: 1000,
      cacheReadTokens: 500,
      cacheWriteTokens: 0,
    }, pool);

    const { rows } = await pool.query(
      `SELECT * FROM llm_usage WHERE operation = 'soap_generation'`
    );
    expect(rows).toHaveLength(1);
    // 2000*3 + 1000*15 + 500*0.3 + 0 = 6000 + 15000 + 150 = 21150 micros
    expect(parseInt(rows[0].cost_usd_micros, 10)).toBe(21150);
    expect(rows[0].input_tokens).toBe(2000);
    expect(rows[0].output_tokens).toBe(1000);
    expect(rows[0].cache_read_tokens).toBe(500);
    expect(rows[0].provider).toBe("anthropic");
  });

  it("records cost=0 when no pricing row exists for the model (and does not throw)", async () => {
    const pool = getTestPool();
    await recordUsage({
      consultationId: null,
      operation: "text_chat",
      provider: "google",
      modelId: "gemini-unknown-model",
      inputTokens: 100,
      outputTokens: 50,
    }, pool);

    const { rows } = await pool.query(
      `SELECT * FROM llm_usage WHERE model_id = 'gemini-unknown-model'`
    );
    expect(rows).toHaveLength(1);
    expect(parseInt(rows[0].cost_usd_micros, 10)).toBe(0);
  });

  it("does not throw when DB write fails", async () => {
    // Simulate failure by closing a fresh pool; recordUsage should swallow.
    const { Pool } = await import("pg");
    const brokenPool = new Pool({ connectionString: "postgres://invalid:invalid@127.0.0.1:1/none" });
    // A connection will fail. The function must catch and return without throwing.
    await expect(
      recordUsage(
        {
          consultationId: null,
          operation: "soap_generation",
          provider: "anthropic",
          modelId: "claude-sonnet-4-6",
          inputTokens: 1,
          outputTokens: 1,
        },
        brokenPool
      )
    ).resolves.toBeUndefined();
    await brokenPool.end().catch(() => undefined);
  });
});

describe("GET /api/v1/admin/llm-usage/summary", () => {
  it("returns aggregate totals plus by-model and by-operation breakdowns", async () => {
    const pool = getTestPool();
    await recordUsage({
      consultationId: null,
      operation: "soap_generation",
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      inputTokens: 1000,
      outputTokens: 500,
    }, pool);
    await recordUsage({
      consultationId: null,
      operation: "text_chat",
      provider: "google",
      modelId: "gemini-2.5-flash",
      inputTokens: 2000,
      outputTokens: 800,
    }, pool);

    const res = await request(adminApp).get("/api/v1/admin/llm-usage/summary");
    expect(res.status).toBe(200);
    expect(res.body.totals.calls).toBe(2);
    expect(res.body.totals.inputTokens).toBe(3000);
    expect(res.body.totals.outputTokens).toBe(1300);
    expect(res.body.byModel).toHaveLength(2);
    expect(res.body.byOperation).toHaveLength(2);
    // Sonnet: 1000*3 + 500*15 = 3000 + 7500 = 10500 micros = $0.010500
    // Flash: 2000*0.3 + 800*2.5 = 600 + 2000 = 2600 micros = $0.002600
    // Total: 13100 micros = $0.013100
    expect(parseFloat(res.body.totals.costUsd)).toBeCloseTo(0.0131, 5);
  });
});

describe("GET /api/v1/admin/llm-usage/summary date range filtering", () => {
  it("respects ?from and ?to query params and excludes out-of-range rows", async () => {
    const pool = getTestPool();
    // Insert a row in the past via raw SQL to control created_at
    await pool.query(
      `INSERT INTO llm_usage (consultation_id, operation, provider, model_id, input_tokens, output_tokens, cost_usd_micros, created_at)
       VALUES (NULL, 'soap_generation', 'anthropic', 'claude-sonnet-4-6', 500, 200, 9000, '2020-01-15T00:00:00Z')`
    );
    await recordUsage({
      consultationId: null,
      operation: "text_chat",
      provider: "google",
      modelId: "gemini-2.5-flash",
      inputTokens: 100,
      outputTokens: 50,
    }, pool);

    // Range that excludes the 2020 row
    const res = await request(adminApp).get("/api/v1/admin/llm-usage/summary?from=2024-01-01&to=2099-01-01");
    expect(res.status).toBe(200);
    expect(res.body.totals.calls).toBe(1);
    expect(res.body.totals.inputTokens).toBe(100);
  });
});

describe("GET /api/v1/admin/llm-usage/by-consultation", () => {
  it("groups rows by consultation and returns top spenders", async () => {
    const pool = getTestPool();
    const { rows: pRows } = await pool.query(
      `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
       VALUES ('llm-sub-1', 'p1@test.com', NOW(), 'v1.0')
       RETURNING id`
    );
    const patientId = pRows[0].id;
    const { rows: cRows } = await pool.query(
      `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint)
       VALUES ($1, 'queued_for_review', 'voice', 'headache')
       RETURNING id`,
      [patientId]
    );
    const consultationId = cRows[0].id;

    await recordUsage({
      consultationId,
      operation: "live_session",
      provider: "google",
      modelId: "gemini-3.1-flash-live-preview",
      inputTokens: 5000,
      outputTokens: 2000,
    }, pool);
    await recordUsage({
      consultationId,
      operation: "soap_generation",
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      inputTokens: 1500,
      outputTokens: 700,
    }, pool);

    const res = await request(adminApp).get("/api/v1/admin/llm-usage/by-consultation");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].consultationId).toBe(consultationId);
    expect(res.body.data[0].callCount).toBe(2);
    expect(res.body.data[0].presentingComplaint).toBe("headache");
  });
});

describe("GET /api/v1/admin/llm-usage/consultation/:id", () => {
  it("returns each call as a separate row", async () => {
    const pool = getTestPool();
    const { rows: pRows } = await pool.query(
      `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
       VALUES ('llm-sub-2', 'p2@test.com', NOW(), 'v1.0')
       RETURNING id`
    );
    const { rows: cRows } = await pool.query(
      `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint)
       VALUES ($1, 'queued_for_review', 'text', 'rash')
       RETURNING id`,
      [pRows[0].id]
    );
    const consultationId = cRows[0].id;

    for (let i = 0; i < 3; i++) {
      await recordUsage({
        consultationId,
        operation: "text_chat",
        provider: "google",
        modelId: "gemini-2.5-flash",
        inputTokens: 100 * (i + 1),
        outputTokens: 50,
      }, pool);
    }

    const res = await request(adminApp).get(`/api/v1/admin/llm-usage/consultation/${consultationId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].operation).toBe("text_chat");
  });
});

describe("GET /api/v1/admin/llm-usage/by-consultation pagination limit clamping", () => {
  it("clamps ?limit=999 to the server maximum of 200", async () => {
    const res = await request(adminApp).get("/api/v1/admin/llm-usage/by-consultation?limit=999");
    expect(res.status).toBe(200);
    // The response limit field must be clamped, not the raw query value
    expect(res.body.pagination.limit).toBe(200);
  });
});
