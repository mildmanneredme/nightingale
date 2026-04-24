// SEC-005: Renewal Business Logic Integrity
//
// Unit tests (DB mocked) for:
// 1. noPriorPrescriptionWarning flag in doctor queue when no sourceConsultationId
// 2. validDays max enforcement on approve endpoint

import request from "supertest";
import { buildTestApp } from "./helpers/app";

jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    { statusCode: 202, headers: { "x-message-id": "renewal-test" } },
    {},
  ]),
}));

const mockPoolQuery = jest.requireMock("../db").pool.query as jest.Mock;

const DOCTOR_SUB = "sec005-doctor-sub";
const DOCTOR_ID = "dddddddd-0000-0000-0000-000000000001";
const PATIENT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RENEWAL_ID = "cccccccc-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// noPriorPrescriptionWarning in queue
// ---------------------------------------------------------------------------
describe("SEC-005: Doctor queue shows noPriorPrescriptionWarning", () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildTestApp(DOCTOR_SUB, "doctor");
  });

  it("includes noPriorPrescriptionWarning: true when source_consultation_id is null", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: RENEWAL_ID,
          status: "pending",
          medication_name: "Metformin",
          dosage: "500mg",
          no_adverse_effects: true,
          condition_unchanged: true,
          patient_notes: null,
          created_at: new Date(),
          valid_until: null,
          alert_48h_sent_at: null,
          source_consultation_id: null, // no prior consultation
          patient_name: "Sam Patient",
          patient_dob: "1990-01-01",
          patient_sex: "male",
        },
      ],
    });

    const res = await request(app).get("/api/v1/renewals/queue").expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].noPriorPrescriptionWarning).toBe(true);
  });

  it("includes noPriorPrescriptionWarning: false when source_consultation_id is set", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: RENEWAL_ID,
          status: "pending",
          medication_name: "Metformin",
          dosage: "500mg",
          no_adverse_effects: true,
          condition_unchanged: true,
          patient_notes: null,
          created_at: new Date(),
          valid_until: null,
          alert_48h_sent_at: null,
          source_consultation_id: "some-consult-uuid",
          patient_name: "Sam Patient",
          patient_dob: "1990-01-01",
          patient_sex: "male",
        },
      ],
    });

    const res = await request(app).get("/api/v1/renewals/queue").expect(200);
    expect(res.body[0].noPriorPrescriptionWarning).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validDays max enforcement
// ---------------------------------------------------------------------------
describe("SEC-005: validDays max enforcement on approve", () => {
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildTestApp(DOCTOR_SUB, "doctor");
    delete process.env.RENEWAL_MAX_VALID_DAYS;
  });

  afterEach(() => {
    delete process.env.RENEWAL_MAX_VALID_DAYS;
  });

  it("returns 400 when validDays exceeds the default maximum (90)", async () => {
    const res = await request(app)
      .post(`/api/v1/renewals/${RENEWAL_ID}/approve`)
      .send({ validDays: 91 })
      .expect(400);

    expect(res.body.error).toMatch(/cannot exceed/i);
    expect(res.body.error).toContain("90");
  });

  it("accepts validDays equal to the maximum (90)", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: DOCTOR_ID, ahpra_number: "MED001", first_name: "Bob", last_name: "Doc" }] })
      .mockResolvedValueOnce({ rows: [{ id: RENEWAL_ID, status: "approved", patient_id: PATIENT_ID, medication_name: "Metformin", dosage: null, valid_until: new Date() }] })
      .mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post(`/api/v1/renewals/${RENEWAL_ID}/approve`)
      .send({ validDays: 90 });

    expect(res.status).not.toBe(400);
  });

  it("respects RENEWAL_MAX_VALID_DAYS env override", async () => {
    process.env.RENEWAL_MAX_VALID_DAYS = "28";

    const res = await request(app)
      .post(`/api/v1/renewals/${RENEWAL_ID}/approve`)
      .send({ validDays: 29 })
      .expect(400);

    expect(res.body.error).toContain("28");
  });
});
