import { Router, RequestHandler } from "express";
import { sendResponseReadyEmail, sendRejectionEmail } from "../services/emailService";
import { scheduleFollowUp } from "./followup";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import { requireApprovedDoctor } from "../middleware/auth";
import {
  AmendConsultationSchema,
  RejectConsultationSchema,
  ApproveConsultationSchema,
} from "../schemas/doctor.schema";
import {
  findDoctorBySub,
  findDoctorStatusBySub,
  insertAuditLog,
  countQueuedConsultationsForDoctor,
  countPlatformQueueStats,
  listQueuedConsultationsForDoctor,
  findConsultationDetailForDoctor,
  approveConsultation,
  findAiDraftForConsultation,
  amendConsultation,
  rejectConsultation,
} from "../repositories/doctor.repository";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// GET /me — returns this doctor's application status (PRD-025)
// ---------------------------------------------------------------------------
router.get("/me", async (req, res, next) => {
  try {
    const status = await findDoctorStatusBySub(cognitoSub(req));
    if (!status) {
      res.status(404).json({ error: "Doctor profile not found" });
      return;
    }
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /queue — full list for approved doctors; counts-only for pending (PRD-025)
// ---------------------------------------------------------------------------
router.get("/queue", async (req, res, next) => {
  try {
    if (Array.isArray(req.query.limit) || Array.isArray(req.query.offset)) {
      res.status(400).json({ error: "limit and offset must be single values" });
      return;
    }

    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    // Pending/rejected doctors get counts only — no PHI reaches an unverified doctor.
    if (doctor.status !== "approved") {
      const stats = await countPlatformQueueStats();
      res.status(200).json({ mode: "counts", ...stats });
      return;
    }

    const rawLimit = parseInt(req.query.limit as string);
    const rawOffset = parseInt(req.query.offset as string);

    if (!isNaN(rawLimit) && (rawLimit < 1 || rawLimit > 100)) {
      res.status(400).json({ error: "limit must be between 1 and 100" });
      return;
    }

    const limit = Math.min(!isNaN(rawLimit) ? rawLimit : 20, 100);
    const offset = Math.max(0, !isNaN(rawOffset) ? rawOffset : 0);

    // Priority sort: LOW_CONFIDENCE and CANNOT_ASSESS flags first, then oldest first
    const [total, rows] = await Promise.all([
      countQueuedConsultationsForDoctor(doctor.id),
      listQueuedConsultationsForDoctor(doctor.id, limit, offset),
    ]);

    res.status(200).json({
      mode: "full",
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /consultations/:id — full consultation detail; writes audit log
// ---------------------------------------------------------------------------
router.get("/consultations/:id", requireApprovedDoctor, async (req, res, next) => {
  try {
    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const row = await findConsultationDetailForDoctor(req.params.id, doctor.id);

    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await insertAuditLog({
      eventType: "consultation.doctor_review_opened",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
    });

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/approve
// ---------------------------------------------------------------------------
router.post("/consultations/:id/approve", requireApprovedDoctor, validateBody(ApproveConsultationSchema), async (req, res, next) => {
  try {
    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const row = await approveConsultation(req.params.id, doctor.id);

    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await insertAuditLog({
      eventType: "consultation.approved",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
    });

    // Fire-and-forget: patient notification is non-blocking
    sendResponseReadyEmail(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send response_ready email")
    );
    scheduleFollowUp(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to schedule follow-up")
    );

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/amend
// ---------------------------------------------------------------------------
router.post("/consultations/:id/amend", requireApprovedDoctor, validateBody(AmendConsultationSchema), async (req, res, next) => {
  try {
    const { doctorDraft } = req.body;

    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    // Fetch current ai_draft for diff
    const fetchRow = await findAiDraftForConsultation(req.params.id, doctor.id);
    if (!fetchRow) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const originalDraft = fetchRow.ai_draft ?? "";
    const diff = computeDiff(originalDraft, doctorDraft.trim());

    const row = await amendConsultation(req.params.id, doctor.id, doctorDraft.trim(), diff);

    await insertAuditLog({
      eventType: "consultation.amended",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
      metadata: { diff },
    });

    // Fire-and-forget: patient notification is non-blocking
    sendResponseReadyEmail(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send response_ready email after amend")
    );
    scheduleFollowUp(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to schedule follow-up after amend")
    );

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /consultations/:id/reject
// ---------------------------------------------------------------------------
router.post("/consultations/:id/reject", requireApprovedDoctor, validateBody(RejectConsultationSchema), async (req, res, next) => {
  try {
    const { reasonCode, message } = req.body;

    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const row = await rejectConsultation(req.params.id, doctor.id, reasonCode, message ?? null);

    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await insertAuditLog({
      eventType: "consultation.rejected",
      actorId: doctor.id,
      ahpraNumber: doctor.ahpra_number,
      consultationId: req.params.id,
      metadata: { reasonCode, messageHash: message ? hashString(message) : null },
    });

    // Fire-and-forget: patient notification is non-blocking
    sendRejectionEmail(req.params.id).catch((err) =>
      logger.error({ err, consultationId: req.params.id }, "Failed to send rejection email")
    );

    res.status(200).json(row);
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
