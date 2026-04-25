import { Router, RequestHandler } from "express";
import multer from "multer";
import { fromBuffer as fileTypeFromBuffer } from "file-type";
import { requireRole } from "../middleware/auth";
import {
  uploadPhoto,
  checkPhotoQuality,
  generatePresignedUrl,
  validatePhotoMimeType,
  validatePhotoSize,
} from "../services/photoStorage";
import { logger } from "../logger";
import {
  findPatientIdBySub,
  findConsultationByIdAndPatient,
  countPhotosByConsultation,
  insertPhoto,
  insertPhotoAuditLog,
  listPhotosByConsultation,
  findDoctorIdBySub,
  findPhotoWithConsultationAccess,
  insertPhotoAccessAuditLog,
} from "../repositories/photo.repository";

const router = Router({ mergeParams: true });

// Memory storage — buffer is processed by sharp before reaching S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit
});

const MAX_PHOTOS_PER_CONSULTATION = 5;

// S-10 / F-105: magic-byte allow-list — never trust the client-declared MIME.
// Detected by `file-type` from the actual file header bytes.
const MAGIC_BYTE_ALLOWED_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/heic",
]);

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// POST /:consultationId/photos
// Upload a single photo. Client may POST up to 5 times (once per photo).
// ---------------------------------------------------------------------------
router.post(
  "/:consultationId/photos",
  upload.single("photo"),
  async (req, res, next) => {
    try {
      const { consultationId } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "No photo file provided (field name: photo)" });
        return;
      }

      if (!validatePhotoMimeType(file.mimetype)) {
        res.status(400).json({
          error: "Unsupported file type. Accepted: JPEG, PNG, HEIC",
        });
        return;
      }

      if (!validatePhotoSize(file.size)) {
        res.status(400).json({ error: "Photo must be between 1 byte and 10 MB" });
        return;
      }

      // S-10 / F-104..F-106: magic-byte inspection. The header-based MIME above
      // is client-controlled; before any sharp call we verify the actual file
      // signature. Rejects e.g. a `.pdf` renamed to `.jpg`.
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !MAGIC_BYTE_ALLOWED_MIME_TYPES.has(detected.mime)) {
        res.status(415).json({ error: "Unsupported media type" });
        return;
      }

      // F-035: Server-side quality check — client flags are ignored entirely.
      // Run before any DB work so we fail fast without consuming DB resources.
      const quality = await checkPhotoQuality(file.buffer);
      if (!quality.passed) {
        // F-036: Return 422 with structured reason.
        const reason = quality.issues.join(", ");
        res.status(422).json({ error: "Image quality insufficient", reason });
        return;
      }

      const patientId = await findPatientIdBySub(cognitoSub(req));
      if (!patientId) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }

      const consultation = await findConsultationByIdAndPatient(consultationId, patientId);
      if (!consultation) {
        res.status(404).json({ error: "Consultation not found" });
        return;
      }

      // Only allow upload while the consultation is active or transcript is ready
      if (!["active", "transcript_ready", "pending"].includes(consultation.status)) {
        res.status(409).json({
          error: "Photos can only be uploaded during an active consultation",
        });
        return;
      }

      // Enforce 5-photo cap
      const count = await countPhotosByConsultation(consultationId);
      if (count >= MAX_PHOTOS_PER_CONSULTATION) {
        res.status(409).json({
          error: `Maximum ${MAX_PHOTOS_PER_CONSULTATION} photos per consultation`,
        });
        return;
      }

      // Strip EXIF, convert HEIC→JPEG, upload to S3.
      // uploadPhoto re-runs quality checks internally and returns server-determined results.
      const stored = await uploadPhoto(file.buffer, consultationId);

      // Persist photo record using server-determined quality values only.
      const row = await insertPhoto(
        consultationId,
        stored.s3Key,
        stored.mimeType,
        stored.sizeBytes,
        stored.widthPx,
        stored.heightPx,
        stored.qualityPassed,
        stored.qualityIssues
      );

      // Audit log
      try {
        await insertPhotoAuditLog(patientId, consultationId, row.id, stored.qualityPassed, stored.qualityIssues);
      } catch (err) {
        logger.error({ err }, "photos: failed to write audit log for photo.uploaded");
      }

      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:consultationId/photos
// Returns photo metadata list. Patient gets count only; doctor/admin get full list.
// ---------------------------------------------------------------------------
router.get("/:consultationId/photos", async (req, res, next) => {
  try {
    const { consultationId } = req.params;
    const user = req.user;
    const role: string = user.role ?? "patient";

    if (role === "patient") {
      const patientId = await findPatientIdBySub(cognitoSub(req));
      if (!patientId) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }
      const consultation = await findConsultationByIdAndPatient(consultationId, patientId);
      if (!consultation) {
        res.status(404).json({ error: "Consultation not found" });
        return;
      }
      // Patient sees count only — photos are clinical records, not a personal gallery
      const count = await countPhotosByConsultation(consultationId);
      res.json({ count });
      return;
    }

    // Doctor / admin: full metadata list
    const rows = await listPhotosByConsultation(consultationId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:consultationId/photos/:photoId/url
// Returns a 15-minute pre-signed URL. Doctor and admin only.
// ---------------------------------------------------------------------------
router.get(
  "/:consultationId/photos/:photoId/url",
  requireRole("doctor", "admin"),
  async (req, res, next) => {
    try {
      const { consultationId, photoId } = req.params;
      const groups: string[] = req.user?.["cognito:groups"] ?? [];
      const isAdmin = groups.includes("admin");

      // Doctors may only access photos from their assigned consultation (SEC-001)
      let doctorId: string | null = null;
      if (!isAdmin) {
        const sub = req.user.sub;
        const dRow = await findDoctorIdBySub(sub);
        if (!dRow) {
          res.status(403).json({ error: "Doctor record not found" });
          return;
        }
        doctorId = dRow.id;
      }

      const photo = await findPhotoWithConsultationAccess(photoId, consultationId, isAdmin, doctorId);

      if (!photo) {
        res.status(404).json({ error: "Photo not found" });
        return;
      }

      const url = await generatePresignedUrl(photo.s3_key);

      // Audit log
      const actorId = req.user.sub;
      const actorRole: string = req.user.role ?? "doctor";
      try {
        await insertPhotoAccessAuditLog(actorId, actorRole, consultationId, photoId);
      } catch (err) {
        logger.error({ err }, "photos: failed to write audit log for photo.access_url_generated");
      }

      res.json({ url, expiresInSeconds: 900 });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
