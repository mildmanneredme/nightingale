// PRD-023: integration tests for the onboarding wizard surface.
//
// Covers:
//   - POST /api/v1/patients/me/onboarding-step (recording + completion)
//   - GET  /api/v1/patients/me returns completeness object
//   - Completeness percentage shifts as required fields fill in
//   - The "*_none_declared" booleans collapse a baseline category to "answered"

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const COGNITO_SUB = "onboarding-sub-001";
const app = buildTestApp(COGNITO_SUB);

beforeEach(async () => {
  await resetTestDb();
  await request(app)
    .post("/api/v1/patients/register")
    .send({ email: "wizard@test.com", privacyPolicyVersion: "v1.0" })
    .expect(201);
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// GET /me — completeness
// ---------------------------------------------------------------------------

describe("GET /api/v1/patients/me — completeness", () => {
  it("returns 0% completeness for a brand-new patient", async () => {
    const res = await request(app).get("/api/v1/patients/me").expect(200);
    expect(res.body.completeness).toBeDefined();
    expect(res.body.completeness.percentage).toBe(0);
    // 6 required + 4 optional + 3 baseline sections = 13 slots, all empty
    expect(res.body.completeness.missingRequired.length).toBeGreaterThan(0);
    expect(res.body.completeness.missingRequired).toEqual(
      expect.arrayContaining([
        "First name", "Last name", "Date of birth",
        "Allergies (or confirm none)",
      ])
    );
  });

  it("ticks completeness up as required fields are filled", async () => {
    await request(app)
      .put("/api/v1/patients/me")
      .send({
        firstName: "Sam",
        lastName: "Patient",
        dateOfBirth: "1990-01-01",
        biologicalSex: "female",
        phone: "0412345678",
        address: "1 Test St, Sydney",
      })
      .expect(200);

    const res = await request(app).get("/api/v1/patients/me").expect(200);
    expect(res.body.completeness.percentage).toBeGreaterThan(40);
    expect(res.body.completeness.missingRequired).not.toContain("First name");
    expect(res.body.completeness.missingRequired).not.toContain("Date of birth");
  });

  it("counts a baseline section as answered when *_none_declared = true", async () => {
    await request(app)
      .put("/api/v1/patients/me")
      .send({
        allergiesNoneDeclared: true,
        medicationsNoneDeclared: true,
        conditionsNoneDeclared: true,
      })
      .expect(200);

    const res = await request(app).get("/api/v1/patients/me").expect(200);
    expect(res.body.completeness.missingRequired).not.toEqual(
      expect.arrayContaining([
        "Allergies (or confirm none)",
        "Current medications (or confirm none)",
        "Known conditions (or confirm none)",
      ])
    );
  });

  it("counts a baseline section as answered when at least one record exists", async () => {
    await request(app)
      .post("/api/v1/patients/me/allergies")
      .send({ name: "Penicillin", severity: "moderate" })
      .expect(201);

    const res = await request(app).get("/api/v1/patients/me").expect(200);
    expect(res.body.completeness.missingRequired).not.toContain(
      "Allergies (or confirm none)"
    );
    // The other two baseline sections still missing — only allergies now answered.
    expect(res.body.completeness.missingRequired).toEqual(
      expect.arrayContaining([
        "Current medications (or confirm none)",
        "Known conditions (or confirm none)",
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// POST /me/onboarding-step
// ---------------------------------------------------------------------------

describe("POST /api/v1/patients/me/onboarding-step", () => {
  it("records a step skip in onboarding_skipped_steps", async () => {
    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 1, skipped: true, skippedFields: ["firstName", "lastName"] })
      .expect(204);

    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT onboarding_skipped_steps, onboarding_completed_at FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    );
    expect(rows[0].onboarding_skipped_steps).toHaveLength(1);
    expect(rows[0].onboarding_skipped_steps[0]).toMatchObject({
      step: 1,
      skipped: true,
      skippedFields: ["firstName", "lastName"],
    });
    expect(rows[0].onboarding_completed_at).toBeNull();
  });

  it("marks onboarding complete only on step 3", async () => {
    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 1, skipped: false })
      .expect(204);
    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 2, skipped: false })
      .expect(204);

    let { rows } = await getTestPool().query(
      "SELECT onboarding_completed_at FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    );
    expect(rows[0].onboarding_completed_at).toBeNull();

    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 3, skipped: false })
      .expect(204);

    ({ rows } = await getTestPool().query(
      "SELECT onboarding_completed_at FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    ));
    expect(rows[0].onboarding_completed_at).not.toBeNull();
  });

  it("rejects an invalid step number", async () => {
    const res = await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 7, skipped: false });
    expect(res.status).toBe(400);
  });

  it("appends each step record (does not overwrite)", async () => {
    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 1, skipped: false })
      .expect(204);
    await request(app)
      .post("/api/v1/patients/me/onboarding-step")
      .send({ step: 1, skipped: true, skippedFields: ["phone"] })
      .expect(204);

    const { rows } = await getTestPool().query(
      "SELECT onboarding_skipped_steps FROM patients WHERE cognito_sub = $1",
      [COGNITO_SUB]
    );
    expect(rows[0].onboarding_skipped_steps).toHaveLength(2);
  });
});
