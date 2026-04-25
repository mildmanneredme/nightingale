// PRD-012: Clinical AI Engine integration tests
// The Anthropic client is mocked — no real API calls are made.
// Tests use a real database to verify DB writes and status transitions.

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";
import { runEngine, computeFlags, withRetry } from "../services/clinicalAiEngine";
import { isPiiClean } from "../services/piiAnonymiser";

// ---------------------------------------------------------------------------
// Mock Anthropic client
// ---------------------------------------------------------------------------

const MOCK_ENGINE_OUTPUT = {
  soap_note: {
    subjective:
      "Patient reports a rash on the left forearm for 3 days, mildly itchy, no systemic symptoms.",
    objective:
      "No in-person examination performed. Patient describes a red, raised rash approximately 5cm across.",
    assessment:
      "Findings may be consistent with allergic contact dermatitis or eczema. No red flag features identified.",
    plan:
      "Consider topical corticosteroid. Advise avoiding potential irritants. Review in 48 hours if not improving. Seek GP if spreading or fever develops.",
    red_flags_detected: [],
  },
  differentials: [
    {
      condition: "Allergic contact dermatitis",
      likelihood_pct: 55,
      rationale: "Localised rash following allergen exposure pattern. No systemic features.",
      confidence: "high",
    },
    {
      condition: "Atopic dermatitis (eczema)",
      likelihood_pct: 30,
      rationale: "Common in adults; presentation consistent. History of atopy not confirmed.",
      confidence: "medium",
    },
    {
      condition: "Tinea corporis",
      likelihood_pct: 15,
      rationale: "Less likely without border clarification, but cannot be excluded.",
      confidence: "low",
    },
  ],
  draft_response:
    "Thank you for your consultation. Based on what you've described, your symptoms may be consistent with an allergic skin reaction. " +
    "We recommend applying a mild over-the-counter hydrocortisone cream. Please see a GP if symptoms worsen or you develop a fever. " +
    "This advice is not a substitute for in-person medical care.",
  cannot_assess: false,
  cannot_assess_reason: null,
};

jest.mock("../services/anthropicClient", () => ({
  callClaude: jest.fn(async () => ({
    content: JSON.stringify(MOCK_ENGINE_OUTPUT),
    inputTokens: 1200,
    outputTokens: 800,
    cacheReadTokens: 0,
    cacheCreationTokens: 1200,
  })),
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const COGNITO_SUB = "engine-test-patient-sub";
const app = buildTestApp(COGNITO_SUB, "patient");

async function createPatientAndConsultation(): Promise<{ patientId: string; consultationId: string }> {
  const patientRes = await request(app)
    .post("/api/v1/patients/register")
    .send({ email: "engine-test@example.com", privacyPolicyVersion: "v1.0" });
  const patientId = patientRes.body.id;

  const consultRes = await request(app)
    .post("/api/v1/consultations")
    .send({ consultationType: "text", presentingComplaint: "Skin rash on left forearm" });
  const consultationId = consultRes.body.id;

  // Transition to transcript_ready
  const pool = getTestPool();
  await pool.query(
    `UPDATE consultations SET status = 'transcript_ready',
     transcript = $1,
     session_started_at = NOW() - INTERVAL '5 minutes',
     session_ended_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify([
        { speaker: "ai", text: "What symptoms are you experiencing?", timestamp_ms: 1000 },
        { speaker: "patient", text: "I have a rash on my left arm for 3 days.", timestamp_ms: 2000 },
        { speaker: "ai", text: "How would you describe the rash?", timestamp_ms: 3000 },
        { speaker: "patient", text: "It is red and itchy.", timestamp_ms: 4000 },
        { speaker: "ai", text: "Any other symptoms?", timestamp_ms: 5000 },
        { speaker: "patient", text: "No, just the rash.", timestamp_ms: 6000 },
      ]),
      consultationId,
    ]
  );

  return { patientId, consultationId };
}

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// computeFlags (unit tests — no DB needed)
// ---------------------------------------------------------------------------

describe("computeFlags", () => {
  const baseConsult = {
    transcript: [
      { speaker: "patient" as const, text: "I have a rash" },
      { speaker: "ai" as const, text: "How long?" },
      { speaker: "patient" as const, text: "3 days" },
    ],
    sessionStartedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sessionEndedAt: new Date().toISOString(),
    isPaediatric: false,
    hasConditions: false,
    hasQualityOverriddenPhotos: false,
    engineOutput: {
      soapNote: {
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        redFlagsDetected: [],
      },
      differentials: [
        { condition: "Contact dermatitis", likelihoodPct: 60, rationale: "", confidence: "high" as const },
        { condition: "Eczema", likelihoodPct: 40, rationale: "", confidence: "medium" as const },
      ],
      draftResponse: "",
      cannotAssess: false,
      cannotAssessReason: null,
    },
  };

  it("returns no flags for a clean high-confidence consultation", () => {
    const flags = computeFlags(baseConsult);
    expect(flags).toHaveLength(0);
  });

  it("sets LOW_CONFIDENCE when top differential < 50%", () => {
    const c = {
      ...baseConsult,
      engineOutput: {
        ...baseConsult.engineOutput,
        differentials: [
          { condition: "A", likelihoodPct: 40, rationale: "", confidence: "medium" as const },
          { condition: "B", likelihoodPct: 35, rationale: "", confidence: "medium" as const },
          { condition: "C", likelihoodPct: 25, rationale: "", confidence: "low" as const },
        ],
      },
    };
    expect(computeFlags(c)).toContain("LOW_CONFIDENCE");
  });

  it("sets INCOMPLETE_INTERVIEW when fewer than 3 patient turns", () => {
    const c = {
      ...baseConsult,
      transcript: [
        { speaker: "patient" as const, text: "rash" },
        { speaker: "patient" as const, text: "3 days" },
      ],
    };
    expect(computeFlags(c)).toContain("INCOMPLETE_INTERVIEW");
  });

  it("sets PEDIATRIC for paediatric patients", () => {
    const c = { ...baseConsult, isPaediatric: true };
    expect(computeFlags(c)).toContain("PEDIATRIC");
  });

  it("sets CHRONIC_CARE when patient has conditions", () => {
    const c = { ...baseConsult, hasConditions: true };
    expect(computeFlags(c)).toContain("CHRONIC_CARE");
  });

  it("sets POOR_PHOTO when photos were quality-overridden", () => {
    const c = { ...baseConsult, hasQualityOverriddenPhotos: true };
    expect(computeFlags(c)).toContain("POOR_PHOTO");
  });

  it("sets CANNOT_ASSESS from engine output", () => {
    const c = {
      ...baseConsult,
      engineOutput: { ...baseConsult.engineOutput, cannotAssess: true, cannotAssessReason: "trauma" },
    };
    expect(computeFlags(c)).toContain("CANNOT_ASSESS");
  });
});

// ---------------------------------------------------------------------------
// runEngine integration tests (real DB, mocked Anthropic)
// ---------------------------------------------------------------------------

describe("runEngine", () => {
  it("transitions consultation to queued_for_review and writes SOAP + differentials + draft", async () => {
    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT status, soap_note, differential_diagnoses, ai_draft, priority_flags
       FROM consultations WHERE id = $1`,
      [consultationId]
    );
    const row = rows[0];

    expect(row.status).toBe("queued_for_review");
    expect(row.soap_note).toBeTruthy();
    expect(row.soap_note.subjective).toBeTruthy();
    expect(row.soap_note.objective).toBeTruthy();
    expect(row.soap_note.assessment).toBeTruthy();
    expect(row.soap_note.plan).toBeTruthy();
    expect(Array.isArray(row.differential_diagnoses)).toBe(true);
    expect(row.differential_diagnoses.length).toBeGreaterThanOrEqual(2);
    expect(row.ai_draft).toBeTruthy();
    expect(Array.isArray(row.priority_flags)).toBe(true);
  });

  it("writes audit log events for ai_output_generated and doctor_queued", async () => {
    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT event_type FROM audit_log WHERE consultation_id = $1 ORDER BY created_at`,
      [consultationId]
    );
    const eventTypes = rows.map((r: { event_type: string }) => r.event_type);
    expect(eventTypes).toContain("consultation.ai_output_generated");
    expect(eventTypes).toContain("consultation.doctor_queued");
  });

  it("skips if consultation is not in transcript_ready status", async () => {
    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    // Set to active (not transcript_ready)
    await pool.query(`UPDATE consultations SET status = 'active' WHERE id = $1`, [consultationId]);

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT status FROM consultations WHERE id = $1`,
      [consultationId]
    );
    // Should remain 'active' — engine skipped
    expect(rows[0].status).toBe("active");
  });

  it("flags ENGINE_FAILED and writes audit log when all retries are exhausted", async () => {
    const { callClaude } = require("../services/anthropicClient");
    callClaude.mockRejectedValueOnce(new Error("API error"))
      .mockRejectedValueOnce(new Error("API error"))
      .mockRejectedValueOnce(new Error("API error"));

    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT priority_flags FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].priority_flags).toContain("ENGINE_FAILED");

    const { rows: auditRows } = await pool.query(
      `SELECT event_type FROM audit_log WHERE consultation_id = $1`,
      [consultationId]
    );
    expect(auditRows.map((r: { event_type: string }) => r.event_type)).toContain(
      "consultation.ai_output_failed"
    );

    // Restore mock
    callClaude.mockResolvedValue({
      content: JSON.stringify(MOCK_ENGINE_OUTPUT),
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 0,
      cacheCreationTokens: 1200,
    });
  });

  // F-029: ai_failed status
  it("sets consultation.status to ai_failed when all retries are exhausted", async () => {
    const { callClaude } = require("../services/anthropicClient");
    callClaude
      .mockRejectedValueOnce(new Error("Bedrock timeout"))
      .mockRejectedValueOnce(new Error("Bedrock timeout"))
      .mockRejectedValueOnce(new Error("Bedrock timeout"));

    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT status FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].status).toBe("ai_failed");

    // Restore mock
    callClaude.mockResolvedValue({
      content: JSON.stringify(MOCK_ENGINE_OUTPUT),
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 0,
      cacheCreationTokens: 1200,
    });
  });

  // F-031: 3 total attempts (MAX_RETRIES = 2 means attempts 0, 1, 2)
  it("calls callClaude exactly 3 times before failing", async () => {
    const { callClaude } = require("../services/anthropicClient");
    callClaude
      .mockRejectedValueOnce(new Error("attempt 1 fail"))
      .mockRejectedValueOnce(new Error("attempt 2 fail"))
      .mockRejectedValueOnce(new Error("attempt 3 fail"));

    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    const callsBefore = callClaude.mock.calls.length;
    await runEngine(consultationId, pool);
    const callsAfter = callClaude.mock.calls.length;

    expect(callsAfter - callsBefore).toBe(3);

    // Restore mock
    callClaude.mockResolvedValue({
      content: JSON.stringify(MOCK_ENGINE_OUTPUT),
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 0,
      cacheCreationTokens: 1200,
    });
  });

  it("transitions to cannot_assess when engine flags the presentation", async () => {
    const { callClaude } = require("../services/anthropicClient");
    callClaude.mockResolvedValueOnce({
      content: JSON.stringify({
        ...MOCK_ENGINE_OUTPUT,
        cannot_assess: true,
        cannot_assess_reason: "Presentation requires physical examination",
        draft_response: "",
      }),
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });

    const { consultationId } = await createPatientAndConsultation();
    const pool = getTestPool();

    await runEngine(consultationId, pool);

    const { rows } = await pool.query(
      `SELECT status, ai_draft, priority_flags FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].status).toBe("cannot_assess");
    expect(rows[0].ai_draft).toContain("in-person examination");
    expect(rows[0].priority_flags).toContain("CANNOT_ASSESS");
  });
});

// ---------------------------------------------------------------------------
// withRetry unit tests (F-031)
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to the specified count and succeeds on the last attempt", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after all retries are exhausted", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow("fail 3");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("makes exactly retries+1 total attempts on repeated failure", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // 0, 1, 2
  });
});

// ---------------------------------------------------------------------------
// PII payload safety tests — automated assertion (PRD F-004)
// ---------------------------------------------------------------------------

describe("PII payload safety", () => {
  it("anonymised transcript passes isPiiClean before being sent to API", () => {
    const rawTranscript =
      "Patient: My Medicare is 2123456701, phone 0412345678, email p@test.com, DOB 15/03/1985.";
    const { anonymiseText } = require("../services/piiAnonymiser");
    const cleaned = anonymiseText(rawTranscript);
    const { clean } = isPiiClean(cleaned);
    expect(clean).toBe(true);
  });

  it("patient context builder never emits raw date of birth", () => {
    const { buildAnonymisedPatientContext } = require("../services/piiAnonymiser");
    const context = buildAnonymisedPatientContext({ dateOfBirth: "1985-03-15" });
    const { clean } = isPiiClean(context);
    expect(clean).toBe(true);
    expect(context).not.toMatch(/1985-03-15/);
  });
});
