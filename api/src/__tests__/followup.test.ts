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
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, 'Jane', 'Followup', 'MED0099999', 'General Practice', TRUE) RETURNING id`,
    [DOCTOR_SUB, "doctor-followup@example.com"]
  );
  const doctorId = dRows[0].id;

  // Create an approved consultation with followup columns set
  const { rows: cRows } = await pool.query(
    `INSERT INTO consultations
       (patient_id, assigned_doctor_id, reviewed_by, presenting_complaint, status,
        ai_draft, reviewed_at, followup_send_at, followup_sent_at)
     VALUES ($1, $2, $2, 'Headache', 'approved',
             'Paracetamol as needed.', NOW() - INTERVAL '37 hours',
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

  it("is idempotent — does not re-send if followup_sent_at is set", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app)
      .post("/api/v1/followup/send")
      .expect(200);

    // Already sent — should not appear in due list again
    expect(res.body.due).toBe(0);
    expect(res.body.sent).toBe(0);
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
          ai_draft, reviewed_at, followup_send_at, followup_sent_at)
       VALUES ($1, $2, $2, 'Back pain', 'approved',
               'Rest and ibuprofen.', NOW() - INTERVAL '37 hours',
               NOW() - INTERVAL '1 hour', NOW())
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
          ai_draft, reviewed_at)
       VALUES ($1, $2, $2, 'Sore throat', 'approved', 'Gargle salt water.', NOW())
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
