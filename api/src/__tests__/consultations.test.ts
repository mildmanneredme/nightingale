import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";

const COGNITO_SUB = "consult-test-sub-xyz";
const OTHER_SUB = "other-patient-sub-789";

const app = buildTestApp(COGNITO_SUB);
const otherApp = buildTestApp(OTHER_SUB);

async function registerPatient(a: ReturnType<typeof buildTestApp>, sub: string) {
  await request(a)
    .post("/api/v1/patients/register")
    .send({ email: `${sub}@test.com`, privacyPolicyVersion: "v1.0" })
    .expect(201);
}

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/consultations
// ---------------------------------------------------------------------------

describe("POST /api/v1/consultations", () => {
  it("creates a consultation and returns id + pending status", async () => {
    await registerPatient(app, COGNITO_SUB);

    const res = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice", presentingComplaint: "sore throat" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      status: "pending",
      consultationType: "voice",
      presentingComplaint: "sore throat",
    });
  });

  it("returns 400 when consultationType is missing", async () => {
    await registerPatient(app, COGNITO_SUB);

    const res = await request(app)
      .post("/api/v1/consultations")
      .send({ presentingComplaint: "sore throat" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/consultationType/i);
  });

  it("returns 400 for invalid consultationType", async () => {
    await registerPatient(app, COGNITO_SUB);

    const res = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "video" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/consultationType/i);
  });

  it("returns 404 when patient has not registered", async () => {
    const res = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice" });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations/:id
// ---------------------------------------------------------------------------

describe("GET /api/v1/consultations/:id", () => {
  it("returns the consultation for the owning patient", async () => {
    await registerPatient(app, COGNITO_SUB);

    const { body: created } = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice", presentingComplaint: "back pain" })
      .expect(201);

    const res = await request(app).get(`/api/v1/consultations/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      status: "pending",
      consultationType: "voice",
    });
  });

  it("returns 404 when another patient tries to access the consultation", async () => {
    await registerPatient(app, COGNITO_SUB);
    await registerPatient(otherApp, OTHER_SUB);

    const { body: created } = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice" })
      .expect(201);

    const res = await request(otherApp).get(`/api/v1/consultations/${created.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent consultation id", async () => {
    await registerPatient(app, COGNITO_SUB);

    const res = await request(app).get(
      "/api/v1/consultations/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations
// ---------------------------------------------------------------------------

describe("GET /api/v1/consultations", () => {
  it("returns all consultations for the authenticated patient", async () => {
    await registerPatient(app, COGNITO_SUB);

    await request(app).post("/api/v1/consultations").send({ consultationType: "voice" });
    await request(app).post("/api/v1/consultations").send({ consultationType: "text" });

    const res = await request(app).get("/api/v1/consultations");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("does not include consultations belonging to other patients", async () => {
    await registerPatient(app, COGNITO_SUB);
    await registerPatient(otherApp, OTHER_SUB);

    await request(app).post("/api/v1/consultations").send({ consultationType: "voice" });
    await request(otherApp).post("/api/v1/consultations").send({ consultationType: "voice" });

    const res = await request(app).get("/api/v1/consultations");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/consultations/:id/end
// ---------------------------------------------------------------------------

describe("POST /api/v1/consultations/:id/end", () => {
  it("transitions status to transcript_ready and stores transcript", async () => {
    await registerPatient(app, COGNITO_SUB);

    const { body: created } = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice" })
      .expect(201);

    const transcript = [
      { speaker: "ai", text: "Hello, what brings you in today?", timestamp_ms: 0 },
      { speaker: "patient", text: "I have a sore throat.", timestamp_ms: 3200 },
    ];

    const res = await request(app)
      .post(`/api/v1/consultations/${created.id}/end`)
      .send({ transcript });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("transcript_ready");

    // Verify transcript persisted to DB
    const pool = getTestPool();
    const { rows } = await pool.query(
      "SELECT transcript FROM consultations WHERE id = $1",
      [created.id]
    );
    expect(rows[0].transcript).toEqual(transcript);
  });

  it("returns 404 when ending a consultation owned by another patient", async () => {
    await registerPatient(app, COGNITO_SUB);
    await registerPatient(otherApp, OTHER_SUB);

    const { body: created } = await request(app)
      .post("/api/v1/consultations")
      .send({ consultationType: "voice" })
      .expect(201);

    const res = await request(otherApp)
      .post(`/api/v1/consultations/${created.id}/end`)
      .send({ transcript: [] });

    expect(res.status).toBe(404);
  });
});
