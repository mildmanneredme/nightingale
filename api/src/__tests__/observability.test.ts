import request from "supertest";
import express from "express";

jest.mock("../db");
jest.mock("../logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { correlationId } from "../middleware/correlationId";
import { errorHandler } from "../middleware/errorHandler";
import clientErrorRouter from "../routes/clientError";
import { logger } from "../logger";

// ─── Correlation ID middleware ────────────────────────────────────────────────

describe("correlationId middleware", () => {
  const app = express();
  app.use(correlationId);
  app.get("/ping", (req, res) => {
    res.json({ id: (req as any).correlationId });
  });

  it("generates req- prefix ID when no header present", async () => {
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^req-[0-9a-f]{8}$/);
  });

  it("uses X-Correlation-ID header value when provided", async () => {
    const res = await request(app)
      .get("/ping")
      .set("X-Correlation-ID", "my-custom-id");
    expect(res.body.id).toBe("my-custom-id");
  });

  it("sets X-Correlation-ID on the response", async () => {
    const res = await request(app).get("/ping");
    expect(res.headers["x-correlation-id"]).toMatch(/^req-[0-9a-f]{8}$/);
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────

describe("errorHandler", () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(correlationId);
  testApp.get("/throw", (_req, _res, next) => {
    const err: any = new Error("boom");
    err.code = "TEST.CODE";
    next(err);
  });
  testApp.get("/throw-bare", (_req, _res, next) => {
    next(new Error("bare error"));
  });
  testApp.get("/throw-client", (_req, _res, next) => {
    const err: any = new Error("Bad input");
    err.status = 400;
    next(err);
  });
  testApp.use(errorHandler);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs INTERNAL.UNHANDLED when err has no code", async () => {
    await request(testApp).get("/throw-bare");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "INTERNAL.UNHANDLED" }),
      expect.any(String)
    );
  });

  it("logs the err.code when present", async () => {
    await request(testApp).get("/throw");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "TEST.CODE" }),
      expect.any(String)
    );
  });

  it("returns 500 and 'Internal server error' for 5xx errors", async () => {
    const res = await request(testApp).get("/throw-bare");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("returns 4xx status and err.message for client errors", async () => {
    const res = await request(testApp).get("/throw-client");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Bad input" });
  });
});

// ─── POST /api/v1/client-error ────────────────────────────────────────────────

describe("POST /api/v1/client-error", () => {
  const app = express();
  app.use(express.json());
  app.use(correlationId);
  app.use("/api/v1/client-error", clientErrorRouter);
  app.use(errorHandler);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 204 for a valid payload", async () => {
    const res = await request(app)
      .post("/api/v1/client-error")
      .send({ errorCode: "UI.RENDER_FAILED", errorMessage: "Something broke", page: "/dashboard" });
    expect(res.status).toBe(204);
  });

  it("returns 400 when errorCode is missing", async () => {
    const res = await request(app)
      .post("/api/v1/client-error")
      .send({ errorMessage: "Something broke" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/errorCode/);
  });

  it("returns 400 when errorCode contains lowercase", async () => {
    const res = await request(app)
      .post("/api/v1/client-error")
      .send({ errorCode: "ui.error", errorMessage: "Something broke" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/errorCode/);
  });

  it("returns 400 when errorMessage is empty", async () => {
    const res = await request(app)
      .post("/api/v1/client-error")
      .send({ errorCode: "UI.ERROR", errorMessage: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/errorMessage/);
  });

  it("returns 400 when errorMessage exceeds 500 chars", async () => {
    const res = await request(app)
      .post("/api/v1/client-error")
      .send({ errorCode: "UI.ERROR", errorMessage: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/errorMessage/);
  });
});
