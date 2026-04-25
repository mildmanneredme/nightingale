import { Router, RequestHandler } from "express";
import multer from "multer";
import { pool } from "../db";
import { requireRole } from "../middleware/auth";
import {
  uploadPhoto,
  generatePresignedUrl,
  validatePhotoMimeType,
  validatePhotoSize,
} from "../services/photoStorage";
import { logger } from "../logger";

const router = Router({ mergeParams: true });

// Memory storage — buffer is processed by sharp before reaching S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit
});

const MAX_PHOTOS_PER_CONSULTATION = 5;

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

async function getPatientId(sub: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0]?.id ?? null;
}

// Verify the consultation belongs to the requesting patient and exists.
async function getConsultationForPatient(
  consultationId: string,
  patientId: string
): Promise<{ id: string; status: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, status FROM consultations WHERE id = $1 AND patient_id = $2`,
    [consultationId, patientId]
  );
  return rows[0] ?? null;
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

      // Client-side quality assessment result passed in body
      const qualityPassed = req.body.qualityPassed === "true" || req.body.qualityPassed === true;
      const qualityOverridden =
        req.body.qualityOverridden === "true" || req.body.qualityOverridden === true;
      let qualityIssues: string[] = [];
      try {
        qualityIssues = req.body.qualityIssues ? JSON.parse(req.body.qualityIssues) : [];
      } catch {
        qualityIssues = [];
      }

      const patientId = await getPatientId(cognitoSub(req));
      if (!patientId) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }

      const consultation = await getConsultationForPatient(consultationId, patientId);
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
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM consultation_photos WHERE consultation_id = $1`,
        [consultationId]
      );
      if (parseInt(countRows[0].count, 10) >= MAX_PHOTOS_PER_CONSULTATION) {
        res.status(409).json({
          error: `Maximum ${MAX_PHOTOS_PER_CONSULTATION} photos per consultation`,
        });
        return;
      }

      // Strip EXIF, convert HEIC→JPEG, upload to S3
      const stored = await uploadPhoto(file.buffer, consultationId);

      // Persist photo record
      const { rows } = await pool.query(
        `INSERT INTO consultation_photos
           (consultation_id, s3_key, mime_type, size_bytes, width_px, height_px,
            quality_passed, quality_issues, quality_overridden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id,
           consultation_id AS "consultationId",
           mime_type AS "mimeType",
           size_bytes AS "sizeBytes",
           width_px AS "widthPx",
           height_px AS "heightPx",
           quality_passed AS "qualityPassed",
           quality_issues AS "qualityIssues",
           quality_overridden AS "qualityOverridden",
           created_at AS "createdAt"`,
        [
          consultationId,
          stored.s3Key,
          stored.mimeType,
          stored.sizeBytes,
          stored.widthPx,
          stored.heightPx,
          qualityPassed,
          JSON.stringify(qualityIssues),
          qualityOverridden,
        ]
      );

      // Audit log
      try {
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('photo.uploaded', $1, 'patient', $2, $3)`,
          [
            patientId,
            consultationId,
            JSON.stringify({
              photoId: rows[0].id,
              qualityPassed,
              qualityOverridden,
              qualityIssues,
            }),
          ]
        );
      } catch (err) {
        logger.error({ err }, "photos: failed to write audit log for photo.uploaded");
      }

      res.status(201).json(rows[0]);
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
      const patientId = await getPatientId(cognitoSub(req));
      if (!patientId) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }
      const consultation = await getConsultationForPatient(consultationId, patientId);
      if (!consultation) {
        res.status(404).json({ error: "Consultation not found" });
        return;
      }
      // Patient sees count only — photos are clinical records, not a personal gallery
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count FROM consultation_photos WHERE consultation_id = $1`,
        [consultationId]
      );
      res.json({ count: parseInt(rows[0].count, 10) });
      return;
    }

    // Doctor / admin: full metadata list
    const { rows } = await pool.query(
      `SELECT
         id,
         consultation_id AS "consultationId",
         mime_type AS "mimeType",
         size_bytes AS "sizeBytes",
         width_px AS "widthPx",
         height_px AS "heightPx",
         quality_passed AS "qualityPassed",
         quality_issues AS "qualityIssues",
         quality_overridden AS "qualityOverridden",
         created_at AS "createdAt"
       FROM consultation_photos
       WHERE consultation_id = $1
       ORDER BY created_at ASC`,
      [consultationId]
    );
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
        const { rows: dRows } = await pool.query(
          `SELECT id FROM doctors WHERE cognito_sub = $1`,
          [sub]
        );
        if (!dRows[0]) {
          res.status(403).json({ error: "Doctor record not found" });
          return;
        }
        doctorId = dRows[0].id as string;
      }

      const { rows } = await pool.query(
        `SELECT cp.id, cp.s3_key
         FROM consultation_photos cp
         JOIN consultations c ON c.id = cp.consultation_id
         WHERE cp.id = $1
           AND cp.consultation_id = $2
           AND ($3::boolean OR c.assigned_doctor_id = $4)`,
        [photoId, consultationId, isAdmin, doctorId]
      );

      if (!rows[0]) {
        res.status(404).json({ error: "Photo not found" });
        return;
      }

      const url = await generatePresignedUrl(rows[0].s3_key);

      // Audit log
      const actorId = req.user.sub;
      const actorRole: string = req.user.role ?? "doctor";
      try {
        await pool.query(
          `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
           VALUES ('photo.access_url_generated', $1, $2, $3, $4)`,
          [
            actorId,
            actorRole,
            consultationId,
            JSON.stringify({ photoId, expirySeconds: 900 }),
          ]
        );
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
