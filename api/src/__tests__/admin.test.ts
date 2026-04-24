import request from "supertest";
import { buildAdminApp } from "./helpers/appAdmin";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const ADMIN_SUB = "admin-sub-001";
const adminApp = buildAdminApp(ADMIN_SUB);

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

async function createPatientAndConsultation(): Promise<{
  patientId: string;
  consultationId: string;
}> {
  const pool = getTestPool();

  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
     VALUES ($1, $2, NOW(), 'v1.0')
     RETURNING id`,
    ["patient-sub-admin-test", "patient@test.com"]
  );
  const patientId = pRows[0].id;

  const { rows: cRows } = await pool.query(
    `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint)
     VALUES ($1, 'queued_for_review', 'voice', 'headache')
     RETURNING id`,
    [patientId]
  );
  const consultationId = cRows[0].id;

  return { patientId, consultationId };
}

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/consultations/:id/reassign
// ---------------------------------------------------------------------------

describe("POST /api/v1/admin/consultations/:id/reassign", () => {
  it("changes assigned_doctor_id and writes audit log", async () => {
    const doctorId = await createDoctor("doctor-sub-reassign");
    const { consultationId } = await createPatientAndConsultation();

    const res = await request(adminApp)
      .post(`/api/v1/admin/consultations/${consultationId}/reassign`)
      .send({ doctorId });

    expect(res.status).toBe(200);
    expect(res.body.assignedDoctorId).toBe(doctorId);

    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT assigned_doctor_id FROM consultations WHERE id = $1`,
      [consultationId]
    );
    expect(rows[0].assigned_doctor_id).toBe(doctorId);

    const { rows: auditRows } = await pool.query(
      `SELECT * FROM audit_log WHERE consultation_id = $1 AND event_type = 'consultation.reassigned'`,
      [consultationId]
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actor_role).toBe("admin");
    expect(auditRows[0].metadata).toHaveProperty("doctorId", doctorId);
  });

  it("returns 400 for non-existent doctorId", async () => {
    const { consultationId } = await createPatientAndConsultation();

    const res = await request(adminApp)
      .post(`/api/v1/admin/consultations/${consultationId}/reassign`)
      .send({ doctorId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/stats  (PRD-016: Beta Launch Readiness)
// ---------------------------------------------------------------------------

describe("GET /api/v1/admin/stats", () => {
  it("returns stats with zero counts on empty DB", async () => {
    const res = await request(adminApp)
      .get("/api/v1/admin/stats")
      .expect(200);

    expect(res.body).toHaveProperty("patients");
    expect(res.body).toHaveProperty("consultations");
    expect(res.body).toHaveProperty("rates");
    expect(res.body).toHaveProperty("followUp");
    expect(res.body.rates.approvalPct).toBeNull(); // no reviewed consultations
  });

  it("calculates correct rates after adding consultations", async () => {
    const doctorId = await createDoctor("doctor-sub-stats");
    const { patientId } = await createPatientAndConsultation();
    const pool = getTestPool();

    // 2 approved, 1 amended, 1 rejected
    for (let i = 0; i < 2; i++) {
      await pool.query(
        `INSERT INTO consultations
           (patient_id, assigned_doctor_id, reviewed_by, status, consultation_type,
            presenting_complaint, ai_draft, reviewed_at)
         VALUES ($1, $2, $2, 'approved', 'text', 'Headache', 'Paracetamol.', NOW())`,
        [patientId, doctorId]
      );
    }
    await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, reviewed_by, status, consultation_type,
          presenting_complaint, ai_draft, doctor_draft, reviewed_at)
       VALUES ($1, $2, $2, 'amended', 'text', 'Cough', 'Draft.', 'Amended.', NOW())`,
      [patientId, doctorId]
    );
    await pool.query(
      `INSERT INTO consultations
         (patient_id, assigned_doctor_id, reviewed_by, status, consultation_type,
          presenting_complaint, reviewed_at)
       VALUES ($1, $2, $2, 'rejected', 'text', 'Fever', NOW())`,
      [patientId, doctorId]
    );

    const res = await request(adminApp)
      .get("/api/v1/admin/stats")
      .expect(200);

    // 4 consultations (2 approved, 1 amended, 1 rejected) → 50% approval
    expect(res.body.rates.approvalPct).toBe(50);
    expect(res.body.rates.amendmentPct).toBe(25);
    expect(res.body.rates.rejectionPct).toBe(25);
    expect(res.body.rates.avgReviewMinutes).not.toBeNull();
  });
});
