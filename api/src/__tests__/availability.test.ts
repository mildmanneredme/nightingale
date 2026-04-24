// PRD-017: Doctor Scheduling & Availability — integration tests

import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { getTestPool, resetTestDb, closeTestPool } from "./helpers/db";

const DOCTOR_SUB = "doctor-sched-001";
let doctorId: string;

beforeAll(async () => {
  await resetTestDb();
  const { rows } = await getTestPool().query(
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, 'Alice', 'Doctor', 'MED0099999', 'General Practice', TRUE)
     RETURNING id`,
    [DOCTOR_SUB, "doctor-sched@example.com"]
  );
  doctorId = rows[0].id;
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/schedule — returns default schedule if none set
// ---------------------------------------------------------------------------
describe("GET /api/v1/doctor/schedule", () => {
  it("returns default Mon–Fri 08:00–18:00, daily cap 20", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/doctor/schedule").expect(200);

    expect(Array.isArray(res.body.weeklyWindows)).toBe(true);
    expect(res.body.dailyCap).toBe(20);
    // Default schedule has 5 windows (Mon–Fri)
    expect(res.body.weeklyWindows).toHaveLength(5);
    expect(res.body.weeklyWindows[0]).toMatchObject({ start_time: "08:00", end_time: "18:00" });
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/doctor/schedule — update windows and daily cap
// ---------------------------------------------------------------------------
describe("PUT /api/v1/doctor/schedule", () => {
  it("updates weekly windows and daily cap", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const newWindows = [
      { day: 1, start_time: "09:00", end_time: "17:00" },
      { day: 3, start_time: "09:00", end_time: "17:00" },
    ];
    const res = await request(app)
      .put("/api/v1/doctor/schedule")
      .send({ weeklyWindows: newWindows, dailyCap: 15 })
      .expect(200);

    expect(res.body.weeklyWindows).toHaveLength(2);
    expect(res.body.dailyCap).toBe(15);
  });

  it("rejects invalid dailyCap (0)", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app)
      .put("/api/v1/doctor/schedule")
      .send({ dailyCap: 0 })
      .expect(400);
  });

  it("rejects non-array weeklyWindows", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app)
      .put("/api/v1/doctor/schedule")
      .send({ weeklyWindows: "not-an-array" })
      .expect(400);
  });

  it("writes audit log on save", async () => {
    const pool = getTestPool();
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE event_type = 'doctor.availability_updated' AND actor_id = $1`,
      [doctorId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Date overrides
// ---------------------------------------------------------------------------
describe("date overrides", () => {
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 7);
  const dateStr = testDate.toISOString().slice(0, 10);

  it("adds a blocked-out date override", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app)
      .post("/api/v1/doctor/schedule/overrides")
      .send({ date: dateStr, available: false, note: "Annual leave" })
      .expect(201);

    expect(res.body.date).toBe(dateStr);
    expect(res.body.available).toBe(false);
    expect(res.body.note).toBe("Annual leave");
  });

  it("returns override in GET /schedule", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/doctor/schedule").expect(200);
    const found = res.body.overrides.find((o: { date: string }) => o.date === dateStr);
    expect(found).toBeDefined();
    expect(found.available).toBe(false);
  });

  it("removes a date override", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app)
      .delete(`/api/v1/doctor/schedule/overrides/${dateStr}`)
      .expect(204);

    const check = await request(app).get("/api/v1/doctor/schedule");
    const found = check.body.overrides.find((o: { date: string }) => o.date === dateStr);
    expect(found).toBeUndefined();
  });

  it("returns 400 for invalid date format", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    await request(app)
      .post("/api/v1/doctor/schedule/overrides")
      .send({ date: "not-a-date", available: false })
      .expect(400);
  });
});

// ---------------------------------------------------------------------------
// Capacity stats
// ---------------------------------------------------------------------------
describe("GET /api/v1/doctor/schedule/capacity", () => {
  it("returns capacity stats with utilisation percentage", async () => {
    const app = buildTestApp(DOCTOR_SUB, "doctor");
    const res = await request(app).get("/api/v1/doctor/schedule/capacity").expect(200);

    expect(typeof res.body.reviewedThisMonth).toBe("number");
    expect(typeof res.body.monthlyCapEstimate).toBe("number");
    expect(typeof res.body.utilisationPct).toBe("number");
    expect(typeof res.body.dailyCapHit).toBe("boolean");
    expect(res.body.utilisationPct).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Response time estimate (patient-facing)
// ---------------------------------------------------------------------------
describe("GET /api/v1/consultations/response-time", () => {
  it("returns a response time estimate", async () => {
    const app = buildTestApp("anyone", "patient");
    const res = await request(app).get("/api/v1/consultations/response-time").expect(200);

    expect(typeof res.body.available).toBe("boolean");
    expect(typeof res.body.estimatedResponseText).toBe("string");
    expect(res.body.estimatedResponseText.length).toBeGreaterThan(0);
  });
});
