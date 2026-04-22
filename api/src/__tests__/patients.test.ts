import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const COGNITO_SUB = "test-sub-abc123";
const app = buildTestApp(COGNITO_SUB);

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/patients/register
// ---------------------------------------------------------------------------

describe("POST /api/v1/patients/register", () => {
  it("creates a new patient record and returns 201 with the patient id", async () => {
    const res = await request(app)
      .post("/api/v1/patients/register")
      .send({
        email: "sarah@example.com",
        privacyPolicyVersion: "v1.0",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      email: "sarah@example.com",
    });
  });

  it("records the privacy policy acceptance timestamp", async () => {
    const before = new Date();

    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT privacy_policy_accepted_at, privacy_policy_version FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    );
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].privacy_policy_accepted_at).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(rows[0].privacy_policy_version).toBe("v1.0");
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/v1/patients/register")
      .send({ privacyPolicyVersion: "v1.0" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("returns 400 when privacyPolicyVersion is missing", async () => {
    const res = await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/privacy/i);
  });

  it("returns 409 when the cognito_sub is already registered", async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);

    const res = await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" });

    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/patients/me
// ---------------------------------------------------------------------------

describe("GET /api/v1/patients/me", () => {
  it("returns the patient profile for the authenticated user", async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);

    const res = await request(app).get("/api/v1/patients/me");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: "sarah@example.com",
      allergies: [],
      medications: [],
      conditions: [],
    });
  });

  it("returns 404 when the patient has not registered yet", async () => {
    const res = await request(app).get("/api/v1/patients/me");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/patients/me
// ---------------------------------------------------------------------------

describe("PUT /api/v1/patients/me", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("updates personal information and returns the updated profile", async () => {
    const res = await request(app)
      .put("/api/v1/patients/me")
      .send({
        fullName: "Sarah Fitzgerald",
        dateOfBirth: "1985-03-14",
        biologicalSex: "female",
        phone: "+61412345678",
        address: "12 Nightingale Lane, Carlton South VIC 3053",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fullName: "Sarah Fitzgerald",
      dateOfBirth: "1985-03-14",
      biologicalSex: "female",
      phone: "+61412345678",
    });
  });

  it("rejects an invalid biologicalSex value", async () => {
    const res = await request(app)
      .put("/api/v1/patients/me")
      .send({ biologicalSex: "unknown" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/biologicalSex/i);
  });

  it("returns 404 when updating a patient who has not registered", async () => {
    await resetTestDb();
    const res = await request(app)
      .put("/api/v1/patients/me")
      .send({ fullName: "Ghost" });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/patients/me/allergies
// ---------------------------------------------------------------------------

describe("POST /api/v1/patients/me/allergies", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("adds an allergy and returns it with an id", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: "Penicillin", severity: "severe" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: "Penicillin",
      severity: "severe",
    });
  });

  it("rejects an invalid severity value", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: "Penicillin", severity: "deadly" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/severity/i);
  });

  it("allergy appears in GET /me response", async () => {
    await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: "Peanuts", severity: "moderate" })
      .expect(201);

    const res = await request(app).get("/api/v1/patients/me");
    expect(res.body.allergies).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Peanuts" })])
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/patients/me/allergies/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/patients/me/allergies/:id", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("removes an allergy from the patient record", async () => {
    const { body: allergy } = await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: "Penicillin", severity: "severe" })
      .expect(201);

    await request(app)
      .delete(`/api/v1/patients/me/allergies/${allergy.id}`)
      .expect(204);

    const res = await request(app).get("/api/v1/patients/me");
    expect(res.body.allergies).toHaveLength(0);
  });

  it("returns 404 when deleting an allergy that does not belong to this patient", async () => {
    const res = await request(app)
      .delete("/api/v1/patients/me/allergies/00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/patients/me/medications
// ---------------------------------------------------------------------------

describe("POST /api/v1/patients/me/medications", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("adds a medication and returns it with an id", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/medications")
      .send({ name: "Metformin", dose: "500mg", frequency: "Twice daily" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: "Metformin",
      dose: "500mg",
      frequency: "Twice daily",
    });
  });

  it("returns 400 when medication name is missing", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/medications")
      .send({ dose: "500mg" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/patients/me/conditions
// ---------------------------------------------------------------------------

describe("POST /api/v1/patients/me/conditions", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("adds a condition and returns it with an id", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/conditions")
      .send({ name: "Type 2 Diabetes" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      name: "Type 2 Diabetes",
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/patients/me (account deletion request)
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/patients/me", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/v1/patients/register")
      .send({ email: "sarah@example.com", privacyPolicyVersion: "v1.0" })
      .expect(201);
  });

  it("sets deletion_requested_at and returns 200, does not hard-delete the record", async () => {
    const res = await request(app).delete("/api/v1/patients/me");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deletion request recorded/i);

    // Record still exists in DB (7-year retention)
    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT deletion_requested_at FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].deletion_requested_at).not.toBeNull();
  });

  it("returns 404 for a patient who has not registered", async () => {
    await resetTestDb();
    const res = await request(app).delete("/api/v1/patients/me");
    expect(res.status).toBe(404);
  });
});
