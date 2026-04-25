// PRD-015: Post-Consultation Follow-Up — integration tests

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { getTestPool, resetTestDb, closeTestPool } from "./helpers/db";

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    { statusCode: 202, headers: { "x-message-id": "followup-msg-001" } },
    {},
  ]),
}));

const PATIENT_SUB = "patient-followup-001";
const DOCTOR_SUB  = "doctor-followup-001";

let patientId: string;
let consultationId: string;
let followupToken: string;

beforeAll(async () => {
  await resetTestDb();
  const pool = getTestPool();

  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, full_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [PATIENT_SUB, "followup-patient@example.com", "Alex Patient"]
  );
  patientId = pRows[0].id;

  const { rows: dRows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, email, full_name, ahpra_number)
     VALUES ($1, $2, 'Jane Followup', 'MED0099999') RETURNING id`,
    [DOCTOR_SUB, "doctor-followup@example.com"]
  );
  const doctorId = dRows[0].id;

  // Create an approved consultation with followup columns set
  const { rows: cRows } = await pool.query(
    `INSERT INTO consultations
       (patient_id, assigned_doctor_id, reviewed_by, presenting_complaint, status,
        consultation_type, ai_draft, reviewed_at, followup_send_at, followup_sent_at)
     VALUES ($1, $2, $2, 'Headache', 'approved',
             'text', 'Paracetamol as needed.', NOW() - INTERVAL '37 hours',
             NOW() - INTERVAL '1 hour', NULL)
     RETURNING id, followup_token`,
    [patientId, doctorId]
  );
  consultationId = cRows[0].id;
  followupToken  = cRows[0].followup_token;
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/followup/send — scheduler trigger
// ---------------------------------------------------------------------------
describe("POST /api/v1/followup/send", () => {
  it("sends follow-up emails for due consultations", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app)
      .post("/api/v1/followup/send")
      .expect(200);

    expect(res.body.sent).toBeGreaterThanOrEqual(1);
    expect(res.body.due).toBeGreaterThanOrEqual(1);

    // followup_sent_at should now be set
    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT followup_sent_at FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].followup_sent_at).not.toBeNull();
  });

  it("blocks re-send once FOLLOWUP_MAX_SENDS is reached", async () => {
    // The first send above already sent once and wrote FOLLOWUP_EMAIL_SENT.
    // Default FOLLOWUP_MAX_SENDS is 3, so we need to send 2 more to hit the limit.
    const app = buildTestApp(PATIENT_SUB, "patient");

    // 2nd send — should succeed (count is now 1, limit is 3)
    const res2 = await request(app).post("/api/v1/followup/send").expect(200);
    expect(res2.body.sent).toBeGreaterThanOrEqual(1);

    // 3rd send — should succeed (count is now 2, limit is 3)
    const res3 = await request(app).post("/api/v1/followup/send").expect(200);
    expect(res3.body.sent).toBeGreaterThanOrEqual(1);

    // 4th send — all blocked, should return 409
    const res4 = await request(app).post("/api/v1/followup/send").expect(409);
    expect(res4.body.error).toBe("Maximum follow-up sends reached");
    expect(res4.body.blocked ?? res4.body).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/followup/respond/:token — patient response
// ---------------------------------------------------------------------------
describe("GET /api/v1/followup/respond/:token", () => {
  it("rejects an invalid response option", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .get(`/api/v1/followup/respond/${followupToken}?response=notvalid`)
      .expect(400);
  });

  it("records 'better' response and redirects", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app)
      .get(`/api/v1/followup/respond/${followupToken}?response=better`)
      .expect(302);

    expect(res.headers.location).toContain("response=better");

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT followup_response, status FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].followup_response).toBe("better");
    expect(rows[0].status).toBe("resolved");
  });

  it("is idempotent — redirects with original response if already responded", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app)
      .get(`/api/v1/followup/respond/${followupToken}?response=worse`)
      .expect(302);

    // Should redirect with original 'better' response, not 'worse'
    expect(res.headers.location).toContain("response=better");
  });

  it("returns 404 for unknown token", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .get("/api/v1/followup/respond/00000000-0000-0000-0000-000000000000?response=better")
      .expect(404);
  });
});

// ---------------------------------------------------------------------------
// 'worse' response — FOLLOWUP_CONCERN flag + re-open
// ---------------------------------------------------------------------------
describe("follow-up 'worse' response", () => {
  let worseConsultationId: string;
  let worseToken: string;

  beforeAll(async () => {
    const pool = getTestPool();
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [DOCTOR_SUB]
    );
    const doctorId = dRows[0].id;

    const { rows } = await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, reviewed_by, presenting_complaint, status,
          consultation_type, ai_draft, reviewed_at, followup_send_at, followup_sent_at)
       VALUES ($1, $2, $2, 'Back pain', 'approved',
               'text', 'Rest and ibuprofen.', NOW() - INTERVAL '37 hours',
               NULL, NOW())
       RETURNING id, followup_token`,
      [patientId, doctorId]
    );
    worseConsultationId = rows[0].id;
    worseToken = rows[0].followup_token;
  });

  it("sets status to followup_concern and adds FOLLOWUP_CONCERN priority flag", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .get(`/api/v1/followup/respond/${worseToken}?response=worse`)
      .expect(302);

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT followup_response, status, priority_flags FROM consultations WHERE id = $1`,
      [worseConsultationId]
    );
    expect(rows[0].followup_response).toBe("worse");
    expect(rows[0].status).toBe("followup_concern");
    expect(rows[0].priority_flags).toContain("FOLLOWUP_CONCERN");
  });

  it("writes consultation.reopened_for_followup audit event", async () => {
    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT event_type FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.reopened_for_followup'`,
      [worseConsultationId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// C-10: Send-count guard (F-047 / F-048 / F-049 / F-050)
// ---------------------------------------------------------------------------
describe("C-10: follow-up send-count guard", () => {
  let c10ConsultationId: string;

  beforeAll(async () => {
    const pool = getTestPool();
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [DOCTOR_SUB]
    );
    const doctorId = dRows[0].id;

    // Insert a fresh consultation that is due for a follow-up
    const { rows } = await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, reviewed_by, presenting_complaint, status,
          consultation_type, ai_draft, reviewed_at, followup_send_at, followup_sent_at)
       VALUES ($1, $2, $2, 'Rash', 'approved',
               'text', 'Apply hydrocortisone.', NOW() - INTERVAL '37 hours',
               NOW() - INTERVAL '1 hour', NULL)
       RETURNING id`,
      [patientId, doctorId]
    );
    c10ConsultationId = rows[0].id;
  });

  it("F-049: each successful send writes FOLLOWUP_EMAIL_SENT to audit_log", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    // Reset FOLLOWUP_MAX_SENDS to 3 (default) for this test
    delete process.env.FOLLOWUP_MAX_SENDS;

    const res = await request(app).post("/api/v1/followup/send").expect(200);
    expect(res.body.sent).toBeGreaterThanOrEqual(1);

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT event_type FROM audit_log
       WHERE consultation_id = $1 AND event_type = 'FOLLOWUP_EMAIL_SENT'`,
      [c10ConsultationId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("F-047/F-048: FOLLOWUP_MAX_SENDS=1 causes 2nd send to return 409", async () => {
    process.env.FOLLOWUP_MAX_SENDS = "1";
    const app = buildTestApp(PATIENT_SUB, "patient");

    // The consultation has already been sent once (from previous test), so
    // with limit=1 the next call should be blocked → 409
    const res = await request(app).post("/api/v1/followup/send").expect(409);
    expect(res.body.error).toBe("Maximum follow-up sends reached");

    // Restore default
    delete process.env.FOLLOWUP_MAX_SENDS;
  });

  it("F-050: send count is derived from audit_log, not a separate column", async () => {
    const pool = getTestPool();
    // Insert a fake extra FOLLOWUP_EMAIL_SENT entry to simulate 3 sends
    // without actually running the endpoint 3 times
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('FOLLOWUP_EMAIL_SENT', $1, 'patient', $1, '{}')`,
      [c10ConsultationId]
    );
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('FOLLOWUP_EMAIL_SENT', $1, 'patient', $1, '{}')`,
      [c10ConsultationId]
    );

    // Now the count is >= 3 (1 from the first test + 2 inserted above), should be blocked
    const app = buildTestApp(PATIENT_SUB, "patient");
    delete process.env.FOLLOWUP_MAX_SENDS;
    const res = await request(app).post("/api/v1/followup/send").expect(409);
    expect(res.body.error).toBe("Maximum follow-up sends reached");
  });
});

// ---------------------------------------------------------------------------
// scheduleFollowUp utility
// ---------------------------------------------------------------------------
describe("scheduleFollowUp", () => {
  it("sets followup_send_at = reviewed_at + 36h for an approved consultation", async () => {
    const pool = getTestPool();
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [DOCTOR_SUB]
    );
    const doctorId = dRows[0].id;

    const { rows } = await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, reviewed_by, presenting_complaint, status,
          consultation_type, ai_draft, reviewed_at)
       VALUES ($1, $2, $2, 'Sore throat', 'approved', 'text', 'Gargle salt water.', NOW())
       RETURNING id`,
      [patientId, doctorId]
    );
    const newId = rows[0].id;

    const { scheduleFollowUp } = await import("../routes/followup");
    await scheduleFollowUp(newId);

    const { rows: updated } = await pool.query(
      `SELECT followup_send_at, reviewed_at FROM consultations WHERE id = $1`,
      [newId]
    );
    const diff = new Date(updated[0].followup_send_at).getTime() - new Date(updated[0].reviewed_at).getTime();
    expect(diff).toBeCloseTo(36 * 60 * 60 * 1000, -5);
  });
});
