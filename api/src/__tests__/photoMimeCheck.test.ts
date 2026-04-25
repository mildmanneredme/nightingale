import express, { RequestHandler } from "express";
import request from "supertest";
import { correlationId } from "../middleware/correlationId";
import { errorHandler } from "../middleware/errorHandler";

// S-10: server-side magic-byte MIME validation on photo upload.
//
// This test is deliberately decoupled from Postgres. The magic-byte gate sits
// before any repository call, so mocking the repository layer (and the
// downstream sharp/S3 pipeline) is sufficient to exercise it through the real
// route handler with supertest.

jest.mock("../services/photoStorage", () => ({
  validatePhotoMimeType: jest.fn(() => true),
  validatePhotoSize: jest.fn((size: number) => size > 0 && size <= 10 * 1024 * 1024),
  checkPhotoQuality: jest.fn(async () => ({ passed: true, issues: [] })),
  uploadPhoto: jest.fn(async (_buffer: Buffer, consultationId: string) => ({
    s3Key: `${consultationId}/mock-uuid.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    widthPx: 1200,
    heightPx: 900,
    qualityPassed: true,
    qualityIssues: [],
  })),
  generatePresignedUrl: jest.fn(async () => "https://s3.example.com/mock"),
}));

const PATIENT_ID = "00000000-0000-0000-0000-000000000aaa";
const CONSULTATION_ID = "00000000-0000-0000-0000-000000000bbb";
const PHOTO_ID = "00000000-0000-0000-0000-000000000ccc";

jest.mock("../repositories/photo.repository", () => ({
  findPatientIdBySub: jest.fn(async () => PATIENT_ID),
  findConsultationByIdAndPatient: jest.fn(async () => ({
    id: CONSULTATION_ID,
    status: "active",
  })),
  countPhotosByConsultation: jest.fn(async () => 0),
  insertPhoto: jest.fn(async () => ({
    id: PHOTO_ID,
    consultationId: CONSULTATION_ID,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    widthPx: 1200,
    heightPx: 900,
    qualityPassed: true,
    qualityIssues: [],
    createdAt: new Date(),
  })),
  insertPhotoAuditLog: jest.fn(async () => undefined),
  listPhotosByConsultation: jest.fn(async () => []),
  findDoctorIdBySub: jest.fn(async () => undefined),
  findPhotoWithConsultationAccess: jest.fn(async () => undefined),
  insertPhotoAccessAuditLog: jest.fn(async () => undefined),
}));

// Imported AFTER jest.mock so the route module picks up the mocks.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const photoRouter = require("../routes/photos").default;

function buildApp(): express.Application {
  const app = express();
  app.use(correlationId);
  app.use(express.json());
  const stubAuth: RequestHandler = (req, _res, next) => {
    req.user = {
      sub: "patient-sub",
      "cognito:groups": ["patient"],
      role: "patient",
      email: "",
    };
    next();
  };
  app.use(stubAuth);
  app.use("/api/v1/consultations", photoRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

// %PDF- header — file-type detects this as application/pdf.
const PDF_BUFFER = Buffer.concat([
  Buffer.from("%PDF-1.4\n", "ascii"),
  Buffer.alloc(64, 0x20),
]);

// Minimal JPEG header (SOI + APP0/JFIF). file-type recognises this as image/jpeg.
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
  0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
  0x00, 0x00,
]);

describe("S-10: magic-byte MIME validation on photo upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 415 when a PDF is uploaded with a .jpg filename and image/jpeg content-type", async () => {
    const res = await request(app)
      .post(`/api/v1/consultations/${CONSULTATION_ID}/photos`)
      .attach("photo", PDF_BUFFER, { filename: "decoy.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/unsupported media type/i);

    // The whole point: nothing downstream of the magic-byte gate runs.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const photoStorage = require("../services/photoStorage");
    expect(photoStorage.checkPhotoQuality).not.toHaveBeenCalled();
    expect(photoStorage.uploadPhoto).not.toHaveBeenCalled();
  });

  it("accepts a buffer with valid JPEG magic bytes and progresses past the MIME gate", async () => {
    const res = await request(app)
      .post(`/api/v1/consultations/${CONSULTATION_ID}/photos`)
      .attach("photo", JPEG_BUFFER, { filename: "rash.jpg", contentType: "image/jpeg" });

    // 201 = the request reached uploadPhoto / insertPhoto. The magic-byte gate did not block.
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: PHOTO_ID,
      consultationId: CONSULTATION_ID,
      mimeType: "image/jpeg",
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const photoStorage = require("../services/photoStorage");
    expect(photoStorage.checkPhotoQuality).toHaveBeenCalledTimes(1);
    expect(photoStorage.uploadPhoto).toHaveBeenCalledTimes(1);
  });
});
