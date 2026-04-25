import request from "supertest";
import { buildTestApp } from "./helpers/app";
import { resetTestDb, getTestPool, closeTestPool } from "./helpers/db";
import * as photoStorage from "../services/photoStorage";

// Mock S3 so tests don't need AWS credentials or a real bucket.
// checkPhotoQuality defaults to passing; individual tests can override it.
jest.mock("../services/photoStorage", () => ({
  validatePhotoMimeType: jest.fn((mime: string) =>
    ["image/jpeg", "image/png", "image/heic", "image/heif", "image/jpg"].includes(
      mime.toLowerCase()
    )
  ),
  validatePhotoSize: jest.fn((size: number) => size > 0 && size <= 10 * 1024 * 1024),
  checkPhotoQuality: jest.fn(async (_buffer: Buffer) => ({
    passed: true,
    issues: [],
  })),
  uploadPhoto: jest.fn(async (_buffer: Buffer, consultationId: string) => ({
    s3Key: `${consultationId}/mock-uuid.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 204800,
    widthPx: 1200,
    heightPx: 900,
    qualityPassed: true,
    qualityIssues: [],
  })),
  generatePresignedUrl: jest.fn(async (_key: string) => "https://s3.example.com/mock-presigned-url"),
}));

const PATIENT_SUB  = "photo-test-patient-sub";
const DOCTOR_A_SUB = "photo-test-doctor-sub";      // assigned doctor
const DOCTOR_B_SUB = "photo-test-doctor-b-sub";    // unassigned doctor (IDOR check)
const ADMIN_SUB    = "photo-test-admin-sub";

const patientApp  = buildTestApp(PATIENT_SUB,  "patient");
const doctorApp   = buildTestApp(DOCTOR_A_SUB, "doctor");
const doctorBApp  = buildTestApp(DOCTOR_B_SUB, "doctor");
const adminApp    = buildTestApp(ADMIN_SUB,    "admin");

// Minimal valid JPEG header bytes
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
]);

let doctorAId: string;

async function createPatient(): Promise<string> {
  const res = await request(patientApp)
    .post("/api/v1/patients/register")
    .send({ email: "photo-patient@example.com", privacyPolicyVersion: "v1.0" });
  return res.body.id;
}

async function createConsultation(): Promise<string> {
  const res = await request(patientApp)
    .post("/api/v1/consultations")
    .send({ consultationType: "text", presentingComplaint: "Skin rash on left arm" });
  const consultationId = res.body.id;
  // Assign to Doctor A so the ownership check passes
  const pool = getTestPool();
  await pool.query(
    `UPDATE consultations SET assigned_doctor_id = $1 WHERE id = $2`,
    [doctorAId, consultationId]
  );
  return consultationId;
}

beforeEach(async () => {
  await resetTestDb();
  // Create Doctor A record (assigned doctor)
  const pool = getTestPool();
  const { rows } = await pool.query(
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, 'Alice', 'DoctorA', 'MED0011111', 'General Practice', TRUE) RETURNING id`,
    [DOCTOR_A_SUB, "doctor-a@photo-test.com"]
  );
  doctorAId = rows[0].id;
  // Doctor B record (NOT assigned to any consultation)
  await pool.query(
    `INSERT INTO doctors (cognito_sub, email, first_name, last_name, ahpra_number, specialty, is_active)
     VALUES ($1, $2, 'Bob', 'DoctorB', 'MED0022222', 'General Practice', TRUE)`,
    [DOCTOR_B_SUB, "doctor-b@photo-test.com"]
  );
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/consultations/:id/photos
// ---------------------------------------------------------------------------

describe("POST /api/v1/consultations/:id/photos", () => {
  it("returns 201 and photo metadata on successful upload", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    const res = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      consultationId,
      mimeType: "image/jpeg",
      sizeBytes: expect.any(Number),
      widthPx: expect.any(Number),
      heightPx: expect.any(Number),
      qualityPassed: true,
    });
  });

  // C-07: qualityOverride in FormData must NOT bypass server-side quality gate (F-034, F-036)
  it("returns 422 when server-side quality check fails, even if qualityOverride: true is sent", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    // Simulate a low-quality image by making checkPhotoQuality return a failure
    jest.spyOn(photoStorage, "checkPhotoQuality").mockResolvedValueOnce({
      passed: false,
      issues: ["blurry"],
    });

    const res = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .field("qualityOverride", "true")   // client attempts to bypass
      .attach("photo", JPEG_BUFFER, { filename: "blurry.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Image quality insufficient");
    expect(res.body.reason).toMatch(/blurry/);
  });

  it("returns 400 when no file is attached", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    const res = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo/i);
  });

  it("returns 400 for an unsupported MIME type", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    const res = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", Buffer.from("fake gif"), {
        filename: "image.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported/i);
  });

  it("returns 404 when the consultation does not belong to the patient", async () => {
    await createPatient();

    // Use a random UUID that doesn't exist
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await request(patientApp)
      .post(`/api/v1/consultations/${fakeId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(404);
  });

  it("returns 409 when the 5-photo cap is reached", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    // Upload 5 photos
    for (let i = 0; i < 5; i++) {
      const res = await request(patientApp)
        .post(`/api/v1/consultations/${consultationId}/photos`)
        .attach("photo", JPEG_BUFFER, { filename: `photo${i}.jpg`, contentType: "image/jpeg" });
      expect(res.status).toBe(201);
    }

    // 6th upload should fail
    const res = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "photo6.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/maximum/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations/:id/photos
// ---------------------------------------------------------------------------

describe("GET /api/v1/consultations/:id/photos", () => {
  it("returns count only for the patient", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    const res = await request(patientApp).get(`/api/v1/consultations/${consultationId}/photos`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1 });
  });

  it("returns full photo list for a doctor", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    const res = await request(doctorApp).get(
      `/api/v1/consultations/${consultationId}/photos`
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      mimeType: "image/jpeg",
      qualityPassed: true,
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations/:id/photos/:photoId/url
// ---------------------------------------------------------------------------

describe("GET /api/v1/consultations/:id/photos/:photoId/url", () => {
  it("returns a pre-signed URL for a doctor", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    const uploadRes = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    const photoId = uploadRes.body.id;

    const urlRes = await request(doctorApp).get(
      `/api/v1/consultations/${consultationId}/photos/${photoId}/url`
    );
    expect(urlRes.status).toBe(200);
    expect(urlRes.body.url).toBeDefined();
    expect(urlRes.body.expiresInSeconds).toBe(900);
  });

  it("returns 403 when a patient requests a pre-signed URL", async () => {
    await createPatient();
    const consultationId = await createConsultation();

    const uploadRes = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    const photoId = uploadRes.body.id;

    const res = await request(patientApp).get(
      `/api/v1/consultations/${consultationId}/photos/${photoId}/url`
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a photo that does not exist", async () => {
    const fakeConsultationId = "00000000-0000-0000-0000-000000000001";
    const fakePhotoId = "00000000-0000-0000-0000-000000000002";

    const res = await request(doctorApp).get(
      `/api/v1/consultations/${fakeConsultationId}/photos/${fakePhotoId}/url`
    );
    expect(res.status).toBe(404);
  });

  // SEC-001: IDOR fix — unassigned doctor must not access another doctor's photos
  it("returns 404 when Doctor B requests a presigned URL for Doctor A's consultation (IDOR)", async () => {
    await createPatient();
    const consultationId = await createConsultation(); // assigned to Doctor A

    const uploadRes = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });
    const photoId = uploadRes.body.id;

    // Doctor B (not assigned) should be blocked
    const res = await request(doctorBApp).get(
      `/api/v1/consultations/${consultationId}/photos/${photoId}/url`
    );
    expect(res.status).toBe(404);
  });

  // SEC-001: Admin bypass — admin can access any consultation's photos
  it("returns presigned URL for an admin regardless of consultation assignment", async () => {
    await createPatient();
    const consultationId = await createConsultation(); // assigned to Doctor A

    const uploadRes = await request(patientApp)
      .post(`/api/v1/consultations/${consultationId}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });
    const photoId = uploadRes.body.id;

    const res = await request(adminApp).get(
      `/api/v1/consultations/${consultationId}/photos/${photoId}/url`
    );
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });
});
