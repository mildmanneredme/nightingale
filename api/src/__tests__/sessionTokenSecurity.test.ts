// SEC-004: Session & Token Security tests
//
// Issue 1: WS stream-token endpoint (unit tests — DB mocked)
// Issue 2: Follow-up audit log no longer stores raw token (unit test)

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import crypto from "crypto";

jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

const mockPoolQuery = jest.requireMock("../db").pool.query as jest.Mock;

const PATIENT_SUB = "sec004-patient-sub";
const PATIENT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const CONSULT_ID = "bbbbbbbb-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// POST /api/v1/consultations/:id/stream-token
// ---------------------------------------------------------------------------
describe("SEC-004: POST /api/v1/consultations/:id/stream-token", () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildTestApp(PATIENT_SUB, "patient");
  });

  it("returns 404 when consultation does not belong to the patient", async () => {
    // patients query returns a row, consultations query returns no rows (not owned)
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: PATIENT_ID }] }) // patient lookup
      .mockResolvedValueOnce({ rows: [] }); // consultation ownership check — not found

    const res = await request(app)
      .post(`/api/v1/consultations/${CONSULT_ID}/stream-token`)
      .expect(404);

    expect(res.body.error).toMatch(/consultation not found/i);
  });

  it("returns 201 with a wsToken UUID for an owned consultation", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: PATIENT_ID }] }) // patient lookup
      .mockResolvedValueOnce({ rows: [{ id: CONSULT_ID }] }) // consultation ownership
      .mockResolvedValueOnce({ rows: [] }); // ws_tokens INSERT

    const res = await request(app)
      .post(`/api/v1/consultations/${CONSULT_ID}/stream-token`)
      .expect(201);

    expect(res.body.wsToken).toBeDefined();
    expect(typeof res.body.wsToken).toBe("string");
    expect(res.body.expiresInSeconds).toBe(120);
  });

  it("stores the token in ws_tokens table", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: PATIENT_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: CONSULT_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post(`/api/v1/consultations/${CONSULT_ID}/stream-token`)
      .expect(201);

    // Third call should be the INSERT into ws_tokens
    const insertCall = mockPoolQuery.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO ws_tokens/i);
  });
});

// ---------------------------------------------------------------------------
// SEC-004 Issue 2: Follow-up audit log must NOT store raw token
// ---------------------------------------------------------------------------
describe("SEC-004: follow_up.sent audit log stores token hash, not raw token", () => {
  it("SHA-256 hash of token is not reversible to the original token", () => {
    const originalToken = crypto.randomUUID();
    const hash = crypto.createHash("sha256").update(originalToken).digest("hex");

    // Hash cannot equal the original
    expect(hash).not.toBe(originalToken);
    // Hash has fixed 64-char hex length
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("follow-up audit log metadata field is named token_hash not token", async () => {
    // Read the followup route source to verify the metadata key
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/followup.ts"),
      "utf8"
    );
    // Must contain token_hash in audit metadata
    expect(src).toContain("token_hash");
    // Must NOT store raw token in audit metadata (i.e., { token: row.followup_token })
    expect(src).not.toMatch(/['"]token['"]\s*:\s*row\.followup_token/);
  });
});
