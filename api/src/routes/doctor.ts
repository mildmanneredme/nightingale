import { Router, RequestHandler } from "express";
import { pool } from "../db";
import { sendResponseReadyEmail, sendRejectionEmail } from "../services/emailService";
import { scheduleFollowUp } from "./followup";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import {
  AmendConsultationSchema,
  RejectConsultationSchema,
  ApproveConsultationSchema,
} from "../schemas/doctor.schema";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

async function getDoctorBySub(sub: string) {
  const { rows } = await pool.query(
    `SELECT id, full_name, ahpra_number, email FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0] ?? null;
}

async function writeAuditLog(params: {
  eventType: string;
  actorId: string;
  ahpraNumber: string;
  consultationId?: string;
  metadata?: Record<string, unknown>;
}) {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, consultation_id, metadata)
     VALUES ($1, $2, 'doctor', $3, $4, $5)`,
    [
      params.eventType,
      params.actorId,
      params.ahpraNumber,
      params.consultationId ?? null,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
}

// ---------------------------------------------------------------------------
// GET /queue — consultations assigned to this doctor in queued_for_review
// ---------------------------------------------------------------------------
router.get("/queue", async (req, res, next) => {
  try {
    const doctor = await getDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    // Priority sort: LOW_CONFIDENCE and CANNOT_ASSESS flags first, then oldest first
    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.status,
         c.consultation_type   AS "consultationType",
         c.presenting_complaint AS "presentingComplaint",
         c.priority_flags      AS "priorityFlags",
         c.created_at          AS "createdAt",
         p.date_of_birth       AS "patientDob",
         p.biological_sex      AS "patientSex"
       FROM consultations c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.assigned_doctor_id = $1
         AND c.status = 'queued_for_review'
       ORDER BY
         CASE WHEN 'LOW_CONFIDENCE' = ANY(c.priority_flags) OR 'CANNOT_ASSESS' = ANY(c.priority_flags)
              THEN 0 ELSE 1 END ASC,
         c.created_at ASC`,
      [doctor.id]
    );

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /consultations/:id — full consultation detail; writes audit log
// ---------------------------------------------------------------------------
router.get("/consultations/:id", async (req, res, next) => {
  try {
    const doctor = await getDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.status,
         c.consultation_type    AS "consultationType",
         c.presenting_complaint AS "presentingComplaint",
         c.transcript,
         c.red_flags            AS "redFlags",
         c.soap_note            AS "soapNote",
         c.differential_diagnoses AS "differentialDiagnoses",
         c.ai_draft             AS "aiDraft",
         c.priority_flags       AS "priorityFlags",
         c.created_at           AS "createdAt",
         p.full_name            AS "patientName",
         p.date_of_birth        AS "patientDob",
         p.biological_sex       AS "patientSex",
         (SELECT json_agg(json_build_object('allergen', a.name, 'severity', a.severity))
          FROM patient_allergies a WHERE a.patient_id = p.id) AS allergies,
         (SELECT json_agg(json_build_object('name', m.name, 'dose', m.dose))
          FROM patient_medications m WHERE m.patient_id = p.id) AS medications,
         (SELECT json_agg(json_build_object('name', con.name))
          FROM patient_conditions con WHERE con.patient_id = p.id) AS conditions
       FROM consultations c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND c.assigned_doctor_id = $2`,
      [req.params.id, doctor.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await writeAuditLog({
      eventType: "consultation.doctor_review_opened",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
    });

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/approve
// ---------------------------------------------------------------------------
router.post("/consultations/:id/approve", validateBody(ApproveConsultationSchema), async (req, res, next) => {
  try {
    const doctor = await getDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE consultations
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND assigned_doctor_id = $1
       RETURNING id, status`,
      [doctor.id, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await writeAuditLog({
      eventType: "consultation.approved",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
    });

    // Fire-and-forget: patient notification is non-blocking
    sendResponseReadyEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send response_ready email")
    );
    scheduleFollowUp(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to schedule follow-up")
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/amend
// ---------------------------------------------------------------------------
router.post("/consultations/:id/amend", validateBody(AmendConsultationSchema), async (req, res, next) => {
  try {
    const { doctorDraft } = req.body;

    const doctor = await getDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    // Fetch current ai_draft for diff
    const { rows: fetchRows } = await pool.query(
      `SELECT ai_draft FROM consultations WHERE id = $1 AND assigned_doctor_id = $2`,
      [req.params.id, doctor.id]
    );
    if (!fetchRows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const originalDraft = fetchRows[0].ai_draft ?? "";
    const diff = computeDiff(originalDraft, doctorDraft.trim());

    const { rows } = await pool.query(
      `UPDATE consultations
       SET status = 'amended',
           doctor_draft = $1,
           amendment_diff = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND assigned_doctor_id = $3
       RETURNING id, status`,
      [doctorDraft.trim(), diff, doctor.id, req.params.id]
    );

    await writeAuditLog({
      eventType: "consultation.amended",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
      metadata: { diff },
    });

    // Fire-and-forget: patient notification is non-blocking
    sendResponseReadyEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send response_ready email after amend")
    );
    scheduleFollowUp(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to schedule follow-up after amend")
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/reject
// ---------------------------------------------------------------------------
router.post("/consultations/:id/reject", validateBody(RejectConsultationSchema), async (req, res, next) => {
  try {
    const { reasonCode, message } = req.body;

    const doctor = await getDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE consultations
       SET status = 'rejected',
           rejection_reason_code = $1,
           rejection_message = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND assigned_doctor_id = $3
       RETURNING id, status`,
      [reasonCode, message ?? null, doctor.id, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await writeAuditLog({
      eventType: "consultation.rejected",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
      metadata: { reasonCode, messageHash: message ? hashString(message) : null },
    });

    // Fire-and-forget: patient notification is non-blocking
    sendRejectionEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send rejection email")
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDiff(original: string, amended: string): string {
  if (original === amended) return "";
  const origLines = original.split("\n");
  const amendLines = amended.split("\n");
  const diff: string[] = [];
  const maxLen = Math.max(origLines.length, amendLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const a = amendLines[i];
    if (o !== undefined && a === undefined) diff.push(`- ${o}`);
    else if (o === undefined && a !== undefined) diff.push(`+ ${a}`);
    else if (o !== a) { diff.push(`- ${o}`); diff.push(`+ ${a}`); }
  }
  return diff.join("\n");
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

export default router;
