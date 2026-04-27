// PRD-009: Text-Chat Fallback — integration tests
// Uses the real DB (seeded per test) with Gemini SDK mocked.

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

// ---------------------------------------------------------------------------
// Mock @google/genai so tests never call Gemini.
// jest.mock is hoisted above variable declarations, so we cannot reference a
// const/let inside the factory. Instead we expose the fn via global and
// capture it in beforeEach.
// ---------------------------------------------------------------------------
jest.mock("@google/genai", () => {
  const sendMessage = jest.fn();
  (global as any).__mockSendMessage = sendMessage;
  return {
    GoogleGenAI: jest.fn().mockReturnValue({
      chats: {
        create: jest.fn().mockReturnValue({ sendMessage }),
      },
    }),
  };
});

let mockSendMessage: jest.Mock;

const COGNITO_SUB = "text-consult-sub-001";
const OTHER_SUB = "other-patient-sub-002";

const app = buildTestApp(COGNITO_SUB);
const otherApp = buildTestApp(OTHER_SUB);

async function registerPatient(a: ReturnType<typeof buildTestApp>, sub: string) {
  await request(a)
    .post("/api/v1/patients/register")
    .send({ email: `${sub}@test.com`, privacyPolicyVersion: "v1.0" })
    .expect(201);
}

async function createTextConsultation(a: ReturnType<typeof buildTestApp>) {
  const res = await request(a)
    .post("/api/v1/consultations")
    .send({ consultationType: "text", presentingComplaint: "headache" })
    .expect(201);
  return res.body.id as string;
}

async function createVoiceConsultation(a: ReturnType<typeof buildTestApp>) {
  const res = await request(a)
    .post("/api/v1/consultations")
    .send({ consultationType: "voice" })
    .expect(201);
  return res.body.id as string;
}

beforeEach(async () => {
  await resetTestDb();
  mockSendMessage = (global as any).__mockSendMessage as jest.Mock;
  mockSendMessage.mockReset();
  mockSendMessage.mockResolvedValue({
    text: JSON.stringify({
      type: "question",
      text: "How long have you had this headache?",
      options: null,
    }),
  });
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/consultations/:id/chat
// ---------------------------------------------------------------------------

describe("POST /api/v1/consultations/:id/chat", () => {
  it("first message activates consultation — status becomes 'active'", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "I have a headache" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("active");

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT status, session_started_at FROM consultations WHERE id = $1",
      [id]
    );
    expect(rows[0].status).toBe("active");
    expect(rows[0].session_started_at).not.toBeNull();
  });

  it("AI question response is returned correctly", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    mockSendMessage.mockResolvedValueOnce({
      text: JSON.stringify({
        type: "question",
        text: "How long have you had this headache?",
        options: ["Less than 24 hours", "1-3 days", "More than 3 days"],
      }),
    });

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "I have a headache" });

    expect(res.status).toBe(200);
    expect(res.body.aiResponse).toMatchObject({
      type: "question",
      text: "How long have you had this headache?",
      options: ["Less than 24 hours", "1-3 days", "More than 3 days"],
    });
    expect(res.body.consultationId).toBe(id);
  });

  it("patient turn is appended to transcript in DB", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "I have a headache" })
      .expect(200);

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT transcript FROM consultations WHERE id = $1",
      [id]
    );
    const transcript = rows[0].transcript as Array<{ speaker: string; text: string }>;
    expect(transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: "patient", text: "I have a headache" }),
        expect.objectContaining({ speaker: "ai" }),
      ])
    );
  });

  it("when AI returns type='emergency', status becomes 'emergency_escalated'", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    mockSendMessage.mockResolvedValueOnce({
      text: JSON.stringify({
        type: "emergency",
        message: "This sounds like a medical emergency. Please call 000 immediately.",
      }),
    });

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "chest pain and can't breathe" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("emergency_escalated");
    expect(res.body.aiResponse.type).toBe("emergency");

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT status FROM consultations WHERE id = $1",
      [id]
    );
    expect(rows[0].status).toBe("emergency_escalated");
  });

  it("when AI returns type='complete', status becomes 'transcript_ready'", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    mockSendMessage.mockResolvedValueOnce({
      text: JSON.stringify({
        type: "complete",
        summary: "Patient reports a 2-day headache, moderate severity, no neurological symptoms.",
      }),
    });

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "yes that covers everything" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("transcript_ready");
    expect(res.body.aiResponse.type).toBe("complete");

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT status, session_ended_at FROM consultations WHERE id = $1",
      [id]
    );
    expect(rows[0].status).toBe("transcript_ready");
    expect(rows[0].session_ended_at).not.toBeNull();
  });

  it("empty message returns 400", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
  });

  it("returns 404 for a voice consultation (wrong type)", async () => {
    await registerPatient(app, COGNITO_SUB);
    const voiceId = await createVoiceConsultation(app);

    const res = await request(app)
      .post(`/api/v1/consultations/${voiceId}/chat`)
      .send({ message: "hi" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for another patient's consultation", async () => {
    await registerPatient(app, COGNITO_SUB);
    await registerPatient(otherApp, OTHER_SUB);

    const id = await createTextConsultation(app);

    const res = await request(otherApp)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "hi" });

    expect(res.status).toBe(404);
  });

  it("handles markdown-fenced JSON from Gemini without leaking raw JSON to the patient", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    mockSendMessage.mockResolvedValueOnce({
      text:
        "```json\n" +
        JSON.stringify({
          type: "emergency",
          message: "Please call 000 immediately or go to your nearest emergency department.",
        }) +
        "\n```",
    });

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "I dropped a brick on my toe on purpose" });

    expect(res.status).toBe(200);
    expect(res.body.aiResponse.type).toBe("emergency");
    expect(res.body.aiResponse.message).toMatch(/000/);
    // Crucially, the raw payload should not contain code fences or a "type"
    // field embedded in the visible message.
    expect(res.body.aiResponse.message).not.toMatch(/```/);
    expect(res.body.aiResponse.message).not.toMatch(/"type"/);
  });

  it("falls back to a safe message when Gemini returns unparseable text", async () => {
    await registerPatient(app, COGNITO_SUB);
    const id = await createTextConsultation(app);

    mockSendMessage.mockResolvedValueOnce({ text: "totally not json" });

    const res = await request(app)
      .post(`/api/v1/consultations/${id}/chat`)
      .send({ message: "hello" });

    expect(res.status).toBe(200);
    expect(res.body.aiResponse.type).toBe("question");
    // Must not echo the raw model output.
    expect(res.body.aiResponse.text).not.toContain("totally not json");
  });
});
