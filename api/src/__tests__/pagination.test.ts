// C-04: Pagination — unit tests covering the envelope shape and limit > 100 guard.
// Tests run against real Postgres (test DB), using the same helpers as other route tests.

import request from "supertest";
import { buildDoctorApp } from "./helpers/appDoctor";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const DOCTOR_SUB = "pag-doctor-001";
const PATIENT_SUB = "pag-patient-001";

const doctorApp = buildDoctorApp(DOCTOR_SUB);
const patientApp = buildTestApp(PATIENT_SUB, "patient");

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

async function seedDoctorAndPatient(): Promise<{ doctorId: string; patientId: string }> {
  const pool = getTestPool();

  const { rows: dRows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, full_name, ahpra_number, email)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [DOCTOR_SUB, "Dr Pagination", "MED0099999", `${DOCTOR_SUB}@doctor.com`]
  );

  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
     VALUES ($1, $2, NOW(), 'v1.0')
     RETURNING id`,
    [PATIENT_SUB, "pag-patient@test.com"]
  );

  return { doctorId: dRows[0].id, patientId: pRows[0].id };
}

async function seedConsultations(doctorId: string, patientId: string, count: number): Promise<string[]> {
  const pool = getTestPool();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { rows } = await pool.query(
      `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint, priority_flags, assigned_doctor_id)
       VALUES ($1, 'queued_for_review', 'text', $2, '{}', $3)
       RETURNING id`,
      [patientId, `complaint ${i + 1}`, doctorId]
    );
    ids.push(rows[0].id);
  }
  return ids;
}

async function seedRenewals(patientId: string, count: number): Promise<string[]> {
  const pool = getTestPool();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { rows } = await pool.query(
      `INSERT INTO renewal_requests (patient_id, medication_name)
       VALUES ($1, $2)
       RETURNING id`,
      [patientId, `Medication ${i + 1}`]
    );
    ids.push(rows[0].id);
  }
  return ids;
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

describe("GET /api/v1/doctor/queue — pagination", () => {
  it("returns envelope with default limit=20, offset=0", async () => {
    const { doctorId, patientId } = await seedDoctorAndPatient();
    await seedConsultations(doctorId, patientId, 3);

    const res = await request(doctorApp).get("/api/v1/doctor/queue").expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      total: 3,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    expect(res.body.data).toHaveLength(3);
  });

  it("returns 400 when limit > 100", async () => {
    await seedDoctorAndPatient();
    const res = await request(doctorApp).get("/api/v1/doctor/queue?limit=200").expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });

  it("applies limit and offset correctly", async () => {
    const { doctorId, patientId } = await seedDoctorAndPatient();
    await seedConsultations(doctorId, patientId, 5);

    const res = await request(doctorApp)
      .get("/api/v1/doctor/queue?limit=2&offset=2")
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({
      total: 5,
      limit: 2,
      offset: 2,
      hasMore: true,
    });
  });

  it("hasMore is true when more items exist beyond current page", async () => {
    const { doctorId, patientId } = await seedDoctorAndPatient();
    await seedConsultations(doctorId, patientId, 25);

    const res = await request(doctorApp)
      .get("/api/v1/doctor/queue?limit=20&offset=0")
      .expect(200);

    expect(res.body.data).toHaveLength(20);
    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.pagination.total).toBe(25);
  });

  it("hasMore is false when on the last page", async () => {
    const { doctorId, patientId } = await seedDoctorAndPatient();
    await seedConsultations(doctorId, patientId, 25);

    const res = await request(doctorApp)
      .get("/api/v1/doctor/queue?limit=20&offset=20")
      .expect(200);

    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it("clamps limit to 100 even if exactly 100 is provided", async () => {
    await seedDoctorAndPatient();
    const res = await request(doctorApp)
      .get("/api/v1/doctor/queue?limit=100")
      .expect(200);
    expect(res.body.pagination.limit).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/renewals  (patient)
// ---------------------------------------------------------------------------

describe("GET /api/v1/renewals — pagination", () => {
  it("returns envelope with pagination metadata", async () => {
    const { patientId } = await seedDoctorAndPatient();
    await seedRenewals(patientId, 3);

    const res = await request(patientApp).get("/api/v1/renewals").expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      total: 3,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("returns 400 when limit > 100", async () => {
    await seedDoctorAndPatient();
    const res = await request(patientApp)
      .get("/api/v1/renewals?limit=101")
      .expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });

  it("applies limit=5 and offset correctly", async () => {
    const { patientId } = await seedDoctorAndPatient();
    await seedRenewals(patientId, 8);

    const res = await request(patientApp)
      .get("/api/v1/renewals?limit=5&offset=5")
      .expect(200);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination).toMatchObject({
      total: 8,
      limit: 5,
      offset: 5,
      hasMore: false,
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/renewals/queue  (doctor)
// ---------------------------------------------------------------------------

describe("GET /api/v1/renewals/queue — pagination", () => {
  const doctorRenewalsApp = buildTestApp(DOCTOR_SUB, "doctor");

  it("returns envelope with pagination metadata", async () => {
    const { patientId } = await seedDoctorAndPatient();
    await seedRenewals(patientId, 2);

    const res = await request(doctorRenewalsApp)
      .get("/api/v1/renewals/queue")
      .expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toMatchObject({
      total: 2,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("returns 400 when limit > 100", async () => {
    await seedDoctorAndPatient();
    const res = await request(doctorRenewalsApp)
      .get("/api/v1/renewals/queue?limit=999")
      .expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations  (patient)
// ---------------------------------------------------------------------------

describe("GET /api/v1/consultations — pagination", () => {
  async function seedConsultationsForPatient(patientId: string, count: number): Promise<void> {
    const pool = getTestPool();
    for (let i = 0; i < count; i++) {
      await pool.query(
        `INSERT INTO consultations (patient_id, status, consultation_type, presenting_complaint, priority_flags)
         VALUES ($1, 'transcript_ready', 'text', $2, '{}')`,
        [patientId, `complaint ${i + 1}`]
      );
    }
  }

  it("returns envelope with pagination metadata", async () => {
    const { patientId } = await seedDoctorAndPatient();
    await seedConsultationsForPatient(patientId, 4);

    const res = await request(patientApp).get("/api/v1/consultations").expect(200);

    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      total: 4,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("returns 400 when limit > 100", async () => {
    await seedDoctorAndPatient();
    const res = await request(patientApp)
      .get("/api/v1/consultations?limit=500")
      .expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });
});
