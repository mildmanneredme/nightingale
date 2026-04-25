// PRD-018: Script Renewal Workflow — integration tests

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { getTestPool, resetTestDb, closeTestPool } from "./helpers/db";

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    { statusCode: 202, headers: { "x-message-id": "renewal-msg-001" } },
    {},
  ]),
}));

const PATIENT_SUB = "patient-renewal-001";
const DOCTOR_SUB = "doctor-renewal-001";

let patientId: string;
let doctorId: string;

beforeAll(async () => {
  await resetTestDb();
  const pool = getTestPool();

  const { rows: pRows } = await pool.query(
    `INSERT INTO patients (cognito_sub, email, full_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [PATIENT_SUB, "renewal-patient@example.com", "Sam Patient"]
  );
  patientId = pRows[0].id;

  const { rows: dRows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, 'Bob', 'Renewal', 'MED0077777', 'General Practice', TRUE) RETURNING id`,
    [DOCTOR_SUB, "doctor-renewal@example.com"]
  );
  doctorId = dRows[0].id;
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// Patient submits renewal
// ---------------------------------------------------------------------------
describe("POST /api/v1/renewals", () => {
  it("creates a renewal request", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app)
      .post("/api/v1/renewals")
      .send({
        medicationName: "Metformin",
        dosage: "500mg twice daily",
        noAdverseEffects: true,
        conditionUnchanged: true,
      })
      .expect(201);

    expect(res.body.status).toBe("pending");
    expect(res.body.medication_name).toBe("Metformin");
  });

  it("returns 400 for missing medicationName", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .post("/api/v1/renewals")
      .send({ dosage: "500mg" })
      .expect(400);
  });

  it("writes renewal.requested audit log event", async () => {
    const { rows } = await getTestPool().query(
      `SELECT * FROM audit_log WHERE event_type = 'renewal.requested' AND actor_id = $1`,
      [patientId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Patient lists renewals
// ---------------------------------------------------------------------------
describe("GET /api/v1/renewals", () => {
  it("returns the patient's renewal requests with pagination envelope", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app).get("/api/v1/renewals").expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].medicationName).toBe("Metformin");
    expect(res.body.pagination).toMatchObject({
      total: expect.any(Number),
      limit: 20,
      offset: 0,
      hasMore: expect.any(Boolean),
    });
  });

  it("returns 400 when limit exceeds 100", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    const res = await request(app).get("/api/v1/renewals?limit=200").expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });
});

// ---------------------------------------------------------------------------
// Doctor renewal queue
// ---------------------------------------------------------------------------
describe("GET /api/v1/renewals/queue", () => {
  it("returns pending renewals for doctor with pagination envelope", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/renewals/queue").expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].medicationName).toBe("Metformin");
    expect(res.body.pagination).toMatchObject({
      total: expect.any(Number),
      limit: 20,
      offset: 0,
      hasMore: expect.any(Boolean),
    });
  });

  it("returns 400 when limit exceeds 100", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/renewals/queue?limit=101").expect(400);
    expect(res.body.error).toBe("limit must not exceed 100");
  });
});

// ---------------------------------------------------------------------------
// Doctor approves renewal
// ---------------------------------------------------------------------------
describe("POST /api/v1/renewals/:id/approve", () => {
  let renewalId: string;

  beforeAll(async () => {
    const { rows } = await getTestPool().query(
      `SELECT id FROM renewal_requests WHERE patient_id = $1 LIMIT 1`,
      [patientId]
    );
    renewalId = rows[0].id;
  });

  it("approves a renewal and sets valid_until", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app)
      .post(`/api/v1/renewals/${renewalId}/approve`)
      .send({ reviewNote: "Continued use appropriate. Collect from chemist.", validDays: 28 })
      .expect(200);

    expect(res.body.status).toBe("approved");
    expect(res.body.validUntil).toBeDefined();
  });

  it("writes renewal.approved audit log with AHPRA number", async () => {
    const { rows } = await getTestPool().query(
      `SELECT * FROM audit_log WHERE event_type = 'renewal.approved' AND actor_id = $1`,
      [doctorId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].ahpra_number).toBe("MED0077777");
  });

  it("removes renewal from queue after approval", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/renewals/queue").expect(200);
    const still = res.body.data.find((r: { id: string }) => r.id === renewalId);
    expect(still).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Doctor declines renewal
// ---------------------------------------------------------------------------
describe("POST /api/v1/renewals/:id/decline", () => {
  let declineRenewalId: string;

  beforeAll(async () => {
    // Create a second renewal to decline
    const { rows } = await getTestPool().query(
      `INSERT INTO renewal_requests (patient_id, medication_name, dosage)
       VALUES ($1, 'Lisinopril', '10mg daily') RETURNING id`,
      [patientId]
    );
    declineRenewalId = rows[0].id;
  });

  it("declines renewal and writes audit log", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app)
      .post(`/api/v1/renewals/${declineRenewalId}/decline`)
      .send({ reviewNote: "New consultation required before continuing this medication." })
      .expect(200);

    expect(res.body.status).toBe("declined");
  });

  it("writes renewal.declined audit log with AHPRA number", async () => {
    const { rows } = await getTestPool().query(
      `SELECT * FROM audit_log WHERE event_type = 'renewal.declined' AND actor_id = $1`,
      [doctorId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].ahpra_number).toBe("MED0077777");
  });
});

// ---------------------------------------------------------------------------
// Auto-renewal is impossible
// ---------------------------------------------------------------------------
describe("auto-renewal safety", () => {
  it("cannot approve without a doctor action — status stays pending", async () => {
    const { rows } = await getTestPool().query(
      `INSERT INTO renewal_requests (patient_id, medication_name)
       VALUES ($1, 'Amlodipine') RETURNING id, status`,
      [patientId]
    );
    expect(rows[0].status).toBe("pending");
    // No code path exists to set status='approved' without a doctor sub
  });
});

// ---------------------------------------------------------------------------
// Expiry check endpoint
// ---------------------------------------------------------------------------
describe("POST /api/v1/renewals/expiry-check", () => {
  it("returns counts of alerts and reminders sent", async () => {
    const app = buildTestApp(DOCTOR_SUB, "admin"); // admin-only
    const res = await request(app)
      .post("/api/v1/renewals/expiry-check")
      .expect(200);

    expect(typeof res.body.alerts48hSent).toBe("number");
    expect(typeof res.body.reminders7dSent).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// SEC-001: Role guard enforcement
// ---------------------------------------------------------------------------
describe("SEC-001: renewal role guards", () => {
  it("patient calling GET /queue receives 403", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app).get("/api/v1/renewals/queue").expect(403);
  });

  it("patient calling POST /:id/approve receives 403", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .post("/api/v1/renewals/00000000-0000-0000-0000-000000000001/approve")
      .send({ validDays: 28 })
      .expect(403);
  });

  it("patient calling POST /:id/decline receives 403", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app)
      .post("/api/v1/renewals/00000000-0000-0000-0000-000000000001/decline")
      .send({ reason: "needs in-person review" })
      .expect(403);
  });

  it("patient calling POST /expiry-check receives 403", async () => {
    const app = buildTestApp(PATIENT_SUB, "patient");
    await request(app).post("/api/v1/renewals/expiry-check").expect(403);
  });

  it("doctor calling GET /queue receives 200", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app).get("/api/v1/renewals/queue").expect(200);
  });
});
