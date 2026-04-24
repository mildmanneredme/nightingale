// SEC-003: API Hardening — rate limiting, security headers, email validation, idempotency
//
// Tests that don't require a DB (headers, email validation) run as unit tests.
// Idempotency and rate limiting tests are marked — the idempotency test requires DB.

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Security Headers (helmet)
// ---------------------------------------------------------------------------
describe("SEC-003: Security headers", () => {
  it("sets X-Frame-Options header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("sets X-Content-Type-Options header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("removes X-Powered-By header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets Strict-Transport-Security header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Email validation — patient registration
// Unit test: auth stubbed; no real DB needed for 400 validation path
// ---------------------------------------------------------------------------

jest.mock("../db", () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
}));

import { buildTestApp } from "./helpers/app";

describe("SEC-003: Email validation at patient registration", () => {
  it("returns 400 for a plaintext non-email string", async () => {
    const testApp = buildTestApp("sub-email-test", "patient");
    const res = await request(testApp)
      .post("/api/v1/patients/register")
      .send({ email: "notanemail", privacyPolicyVersion: "v1.0" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("returns 400 for email missing domain", async () => {
    const testApp = buildTestApp("sub-email-test", "patient");
    const res = await request(testApp)
      .post("/api/v1/patients/register")
      .send({ email: "user@", privacyPolicyVersion: "v1.0" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for email missing local part", async () => {
    const testApp = buildTestApp("sub-email-test", "patient");
    const res = await request(testApp)
      .post("/api/v1/patients/register")
      .send({ email: "@domain.com", privacyPolicyVersion: "v1.0" });
    expect(res.status).toBe(400);
  });

  it("accepts a valid email format", async () => {
    const mockPool = jest.requireMock("../db").pool;
    mockPool.query.mockResolvedValue({ rows: [{ id: "patient-uuid" }] });

    const testApp = buildTestApp("sub-email-valid", "patient");
    const res = await request(testApp)
      .post("/api/v1/patients/register")
      .send({ email: "valid@example.com", privacyPolicyVersion: "v1.0" });
    // Should not be 400 — may be 201 or other non-400 if DB mock returns a row
    expect(res.status).not.toBe(400);
  });
});
