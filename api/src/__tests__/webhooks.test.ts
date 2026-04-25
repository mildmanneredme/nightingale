// SEC-002: Email & Webhook Security — webhook signature verification tests
//
// These are unit tests: pool and @sendgrid/eventwebhook are mocked so no DB needed.

import request from "supertest";
import express, { RequestHandler } from "express";
import { errorHandler } from "../middleware/errorHandler";
import webhooksRouter from "../routes/webhooks";

// Mock the pool so no DB is needed for these unit tests
jest.mock("../db", () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
}));

// Mock @sendgrid/eventwebhook so we can control signature verification results
const mockVerifySignature = jest.fn();
const mockConvertPublicKeyToECDH = jest.fn().mockReturnValue("mock-ecdh-key");
jest.mock("@sendgrid/eventwebhook", () => ({
  EventWebhook: jest.fn().mockImplementation(() => ({
    convertPublicKeyToECDSA: mockConvertPublicKeyToECDH,
    verifySignature: mockVerifySignature,
  })),
}));

const FAKE_PUB_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEfake==";

function buildWebhookApp(): express.Application {
  const app = express();
  // Raw body BEFORE json — mirrors production app.ts
  app.use("/api/v1/webhooks/sendgrid", express.raw({ type: "*/*" }));
  app.use(express.json());
  const stubAuth: RequestHandler = (req, _res, next) => {
    req.user = { sub: "system", "cognito:groups": ["admin"], role: "admin", email: "" };
    next();
  };
  app.use(stubAuth);
  app.use("/api/v1/webhooks", webhooksRouter);
  app.use(errorHandler);
  return app;
}

const VALID_BODY = JSON.stringify([
  { event: "delivered", sg_message_id: "msg-001.filter", email: "p@example.com", timestamp: 1700000000 },
]);

describe("SEC-002: SendGrid webhook signature verification", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildWebhookApp();
  });

  it("returns 500 when SENDGRID_WEBHOOK_PUBLIC_KEY is not set", async () => {
    delete process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

    const res = await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", "sig")
      .set("x-twilio-email-event-webhook-timestamp", "123456")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("returns 403 when signature headers are missing", async () => {
    process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = FAKE_PUB_KEY;

    const res = await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/signature/i);
  });

  it("returns 403 when signature is present but invalid", async () => {
    process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = FAKE_PUB_KEY;
    mockVerifySignature.mockReturnValue(false);

    const res = await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", "bad-sig")
      .set("x-twilio-email-event-webhook-timestamp", "123456")
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 200 and processes events when signature is valid", async () => {
    process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = FAKE_PUB_KEY;
    mockVerifySignature.mockReturnValue(true);

    const res = await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", "valid-sig")
      .set("x-twilio-email-event-webhook-timestamp", "123456")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  it("verifySignature is called with raw body bytes", async () => {
    process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = FAKE_PUB_KEY;
    mockVerifySignature.mockReturnValue(true);

    await request(app)
      .post("/api/v1/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", "valid-sig")
      .set("x-twilio-email-event-webhook-timestamp", "123456")
      .send(VALID_BODY);

    expect(mockVerifySignature).toHaveBeenCalledWith(
      "mock-ecdh-key",
      expect.any(Buffer),
      "valid-sig",
      "123456"
    );
  });
});
