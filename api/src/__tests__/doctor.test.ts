import request from "supertest";
import { buildDoctorApp } from "./helpers/appDoctor";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const DOCTOR_SUB = "doctor-sub-001";
const OTHER_DOCTOR_SUB = "doctor-sub-002";
const PATIENT_SUB = "patient-sub-001";

const doctorApp = buildDoctorApp(DOCTOR_SUB);
const otherDoctorApp = buildDoctorApp(OTHER_DOCTOR_SUB);
const patientApp = buildTestApp(PATIENT_SUB);

async function createDoctor(
  sub: string,
  ahpraNumber: string = "MED0001234"
): Promise<string> {
  const pool = getTestPool();
  const { rows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, full_name, ahpra_number, email)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [sub, "Dr Test Doctor", ahpraNumber, `${sub}@doctor.com`]
  );
  return rows[0].id;
}

async function createPatientAndConsultation(
  status: string = "queued_for_review"
): Promise<{ patientId: string; consultationId: string }> {
  const pool = getTestPool();

  // Create patient
  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
     VALUES ($1, $2, NOW(), 'v1.0')
     RETURNING id`,
    [PATIENT_SUB, "patient@test.com"]
  );
  const patientId = pRows[0].id;

  // Create consultation
  const { rows: cRows } = await pool.query(
    `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint, ai_draft, soap_note, differential_diagnoses, red_flags, priority_flags)
     VALUES ($1, $2, 'voice', 'sore throat', 'AI draft text', '{"subjective":"patient reports sore throat"}', '[{"diagnosis":"pharyngitis","rank":1}]', '[{"phrase":"chest pain"}]', '{}')
     RETURNING id`,
    [patientId, status]
  );
  const consultationId = cRows[0].id;

  return { patientId, consultationId };
}

async function assignDoctor(
  consultationId: string,
  doctorId: string
): Promise<void> {
  const pool = getTestPool();
  await pool.query(
    `UPDATE consultations SET assigned_doctor_id = $1 WHERE id = $2`,
    [doctorId, consultationId]
  );
}

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/queue
// ---------------------------------------------------------------------------

describe("GET /api/v1/doctor/queue", () => {
  it("returns consultations assigned to this doctor only", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp).get("/api/v1/doctor/queue");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(consultationId);
  });

  it("excludes other doctors' consultations", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const otherDoctorId = await createDoctor(OTHER_DOCTOR_SUB, "MED0009999");
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, otherDoctorId);

    const res = await request(doctorApp).get("/api/v1/doctor/queue");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns 404 when doctor is not registered", async () => {
    const res = await request(doctorApp).get("/api/v1/doctor/queue");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/consultations/:id
// ---------------------------------------------------------------------------

describe("GET /api/v1/doctor/consultations/:id", () => {
  it("returns full consultation detail and writes audit log", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp).get(
      `/api/v1/doctor/consultations/${consultationId}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: consultationId,
      presentingComplaint: "sore throat",
      aiDraft: "AI draft text",
    });
    expect(res.body.soapNote).toBeTruthy();
    expect(res.body.differentialDiagnoses).toBeTruthy();

    // Audit log written
    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.doctor_review_opened'`,
      [consultationId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_role).toBe("doctor");
    expect(rows[0].ahpra_number).toBe("MED0001234");
  });

  it("returns 404 for a consultation not assigned to this doctor", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const otherDoctorId = await createDoctor(OTHER_DOCTOR_SUB, "MED0009999");
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, otherDoctorId);

    const res = await request(doctorApp).get(
      `/api/v1/doctor/consultations/${consultationId}`
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/doctor/consultations/:id/approve
// ---------------------------------------------------------------------------

describe("POST /api/v1/doctor/consultations/:id/approve", () => {
  it("sets status=approved and writes audit log with ahpra_number", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp)
      .post(`/api/v1/doctor/consultations/${consultationId}/approve`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");

    // Verify DB
    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT status, reviewed_by, reviewed_at FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].status).toBe("approved");
    expect(rows[0].reviewed_by).toBe(doctorId);
    expect(rows[0].reviewed_at).toBeTruthy();

    // Audit log
    const { rows: auditRows } = await pool.query(
      `SELECT * FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.approved'`,
      [consultationId]
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].ahpra_number).toBe("MED0001234");
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/doctor/consultations/:id/amend
// ---------------------------------------------------------------------------

describe("POST /api/v1/doctor/consultations/:id/amend", () => {
  it("stores doctorDraft and sets status=amended", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const doctorDraft = "Updated assessment by doctor";

    const res = await request(doctorApp)
      .post(`/api/v1/doctor/consultations/${consultationId}/amend`)
      .send({ doctorDraft });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("amended");

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT status, doctor_draft, amendment_diff FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].status).toBe("amended");
    expect(rows[0].doctor_draft).toBe(doctorDraft);
    expect(rows[0].amendment_diff).toBeTruthy();

    // Audit log
    const { rows: auditRows } = await pool.query(
      `SELECT * FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.amended'`,
      [consultationId]
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].ahpra_number).toBe("MED0001234");
    expect(auditRows[0].metadata).toHaveProperty("diff");
  });

  it("returns 400 when doctorDraft is missing", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp)
      .post(`/api/v1/doctor/consultations/${consultationId}/amend`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/doctor/consultations/:id/reject
// ---------------------------------------------------------------------------

describe("POST /api/v1/doctor/consultations/:id/reject", () => {
  it("sets status=rejected with valid reasonCode", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp)
      .post(`/api/v1/doctor/consultations/${consultationId}/reject`)
      .send({ reasonCode: "physical_exam_required", message: "Patient needs physical exam" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT status, rejection_reason_code, rejection_message FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].status).toBe("rejected");
    expect(rows[0].rejection_reason_code).toBe("physical_exam_required");
    expect(rows[0].rejection_message).toBe("Patient needs physical exam");

    // Audit log
    const { rows: auditRows } = await pool.query(
      `SELECT * FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.rejected'`,
      [consultationId]
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].ahpra_number).toBe("MED0001234");
    expect(auditRows[0].metadata).toHaveProperty("reasonCode", "physical_exam_required");
  });

  it("returns 400 for invalid reasonCode", async () => {
    const doctorId = await createDoctor(DOCTOR_SUB);
    const { consultationId } = await createPatientAndConsultation(
      "queued_for_review"
    );
    await assignDoctor(consultationId, doctorId);

    const res = await request(doctorApp)
      .post(`/api/v1/doctor/consultations/${consultationId}/reject`)
      .send({ reasonCode: "invalid_code" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "reasonCode" }),
      ])
    );
  });
});
