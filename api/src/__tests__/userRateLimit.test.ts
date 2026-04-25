// C-09 / F-042–F-046: Per-user rate limiting on authenticated routes
//
// Each describe block builds a fresh Express app with fresh rateLimit instances
// so in-memory counters never bleed between test cases.

import express, { RequestHandler } from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { correlationId } from "../middleware/correlationId";
import { errorHandler } from "../middleware/errorHandler";
import consultationRouter from "../routes/consultations";
import renewalsRouter from "../routes/renewals";

// ---------------------------------------------------------------------------
// Mock heavy dependencies — these tests exercise the rate-limit layer only.
// ---------------------------------------------------------------------------

jest.mock("../db", () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
}));

// ---------------------------------------------------------------------------
// Factory: build a minimal app with fresh per-user limiter instances.
// Accepts an optional override for the write limit so tests can run quickly.
// ---------------------------------------------------------------------------

function buildRateLimitApp(options?: {
  writeMax?: number;
  readMax?: number;
}): express.Application {
  const writeMax = options?.writeMax ?? 5;
  const readMax = options?.readMax ?? 60;

  const userWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: writeMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user as { sub: string }).sub,
    skip: (req) => req.method !== "POST",
    message: { error: "Too many requests — please try again later" },
  });

  const userReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: readMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user as { sub: string }).sub,
    skip: (req) => req.method === "POST",
    message: { error: "Too many requests — please try again later" },
  });

  // Returns a stub auth middleware that injects a known user.sub.
  function stubAuth(sub: string): RequestHandler {
    return (req, _res, next) => {
      req.user = { sub, "cognito:groups": ["patient"], role: "patient", email: "test@example.com" };
      next();
    };
  }

  const app = express();
  app.use(correlationId);
  app.use(express.json());

  // Minimal authenticated route mount — mirrors app.ts pattern.
  // POST /api/v1/consultations and POST /api/v1/renewals are the clinical write ops.
  app.use(
    "/api/v1/consultations",
    // Auth is stubbed via header: X-Test-Sub (set per request in tests).
    ((req, _res, next) => {
      const sub = req.headers["x-test-sub"] as string | undefined;
      req.user = {
        sub: sub ?? "default-sub",
        "cognito:groups": ["patient"],
        role: "patient",
        email: "test@example.com",
      };
      next();
    }) as RequestHandler,
    userWriteLimiter,
    userReadLimiter,
    consultationRouter
  );

  app.use(
    "/api/v1/renewals",
    ((req, _res, next) => {
      const sub = req.headers["x-test-sub"] as string | undefined;
      req.user = {
        sub: sub ?? "default-sub",
        "cognito:groups": ["patient"],
        role: "patient",
        email: "test@example.com",
      };
      next();
    }) as RequestHandler,
    userWriteLimiter,
    userReadLimiter,
    renewalsRouter
  );

  // Simple GET endpoint for read-limit tests (no DB involvement).
  app.get(
    "/api/v1/test-read",
    ((req, _res, next) => {
      const sub = req.headers["x-test-sub"] as string | undefined;
      req.user = {
        sub: sub ?? "default-sub",
        "cognito:groups": ["patient"],
        role: "patient",
        email: "test@example.com",
      };
      next();
    }) as RequestHandler,
    userWriteLimiter,
    userReadLimiter,
    (_req, res) => res.json({ ok: true })
  );

  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// F-043 / F-045: Write limiter — 5 POST/min per user.sub
// ---------------------------------------------------------------------------

describe("C-09 F-043: write limiter — 5 POST/min per user", () => {
  let app: express.Application;

  beforeEach(() => {
    // Fresh app = fresh in-memory store for each test
    app = buildRateLimitApp();
  });

  it("allows exactly 5 POST requests from the same user", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/consultations")
        .set("x-test-sub", "user-a")
        .send({ presentingComplaint: "headache", answers: [] });
      // Validation may fail (400) but NOT rate-limited (429)
      expect(res.status).not.toBe(429);
    }
  });

  it("returns 429 with Retry-After on the 6th POST from the same user", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/consultations")
        .set("x-test-sub", "user-b")
        .send({ presentingComplaint: "headache", answers: [] });
    }
    const res = await request(app)
      .post("/api/v1/consultations")
      .set("x-test-sub", "user-b")
      .send({ presentingComplaint: "headache", answers: [] });

    expect(res.status).toBe(429);
    // F-045: Retry-After header must be present
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.error).toMatch(/too many requests/i);
  });
});

// ---------------------------------------------------------------------------
// F-046: Limits are per user.sub, NOT shared across users
// ---------------------------------------------------------------------------

describe("C-09 F-046: limits are per user.sub, not shared", () => {
  it("two users from the same IP can each make 5 POST requests", async () => {
    const app = buildRateLimitApp();

    // User A — 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/consultations")
        .set("x-test-sub", "user-c")
        .send({ presentingComplaint: "cough", answers: [] });
      expect(res.status).not.toBe(429);
    }

    // User B from the same supertest agent (same "IP") — should also get 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/consultations")
        .set("x-test-sub", "user-d")
        .send({ presentingComplaint: "cough", answers: [] });
      expect(res.status).not.toBe(429);
    }
  });
});

// ---------------------------------------------------------------------------
// F-044: Read limiter does NOT block POST; write limiter does NOT block GET
// ---------------------------------------------------------------------------

describe("C-09 F-044: method separation — write limit does not affect GETs", () => {
  it("GET request is not blocked even after the write limit is exhausted", async () => {
    const app = buildRateLimitApp();

    // Exhaust the write limiter for user-e
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/consultations")
        .set("x-test-sub", "user-e")
        .send({ presentingComplaint: "cough", answers: [] });
    }

    // Confirm write limit is indeed hit
    const blockedPost = await request(app)
      .post("/api/v1/consultations")
      .set("x-test-sub", "user-e")
      .send({ presentingComplaint: "cough", answers: [] });
    expect(blockedPost.status).toBe(429);

    // GET must still succeed (read limiter hasn't been touched)
    const getRes = await request(app)
      .get("/api/v1/test-read")
      .set("x-test-sub", "user-e");
    expect(getRes.status).not.toBe(429);
    expect(getRes.status).toBe(200);
  });
});
