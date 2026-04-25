// PRD-018: Script Renewal Workflow
//
// Patient-facing routes: submit renewal request, list own renewals.
// Doctor-facing routes: renewal queue, approve, decline.
// Expiry admin route: fire 48h queue alerts + 7-day patient reminders.
//
// IMPORTANT: eScript issuance is NOT implemented here (Phase 2 — Fred Dispense/ScriptPad).
// Doctor approval is recorded in this system; the doctor handles prescription issuance
// via their own prescribing system externally. This is the agreed MVP mechanism until
// eScript integration is confirmed with the healthcare lawyer.

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth";
import { sendRenewalApprovedEmail, sendRenewalDeclinedEmail, sendRenewalReminderEmail } from "../services/emailService";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import {
  CreateRenewalSchema,
  ApproveRenewalSchema,
  DeclineRenewalSchema,
} from "../schemas/renewal.schema";
import {
  findPatientIdBySub,
  verifyConsultationOwnership,
  insertRenewal,
  insertRenewalRequestedAuditLog,
  countRenewalsByPatient,
  listRenewalsByPatient,
  countPendingRenewals,
  listPendingRenewals,
  findDoctorBySub,
  findDoctorBySubForDecline,
  approveRenewal,
  insertRenewalApprovedAuditLog,
  declineRenewal,
  insertRenewalDeclinedAuditLog,
  findRenewalsExpiring48h,
  markAlert48hSent,
  insertExpiryAlertAuditLog,
  findRenewalsExpiring7d,
  markReminder7dSent,
  insertPatientReminderAuditLog,
} from "../repositories/renewal.repository";
import { pool } from "../db";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// PATIENT ROUTES
// ---------------------------------------------------------------------------

// POST /api/v1/renewals
// Submit a new script renewal request.
router.post("/", validateBody(CreateRenewalSchema), async (req, res, next) => {
  try {
    const {
      sourceConsultationId,
      medicationName,
      dosage,
      noAdverseEffects = true,
      conditionUnchanged = true,
      patientNotes,
      remindersEnabled = true,
    } = req.body as {
      sourceConsultationId?: string;
      medicationName: string;
      dosage?: string;
      noAdverseEffects?: boolean;
      conditionUnchanged?: boolean;
      patientNotes?: string;
      remindersEnabled?: boolean;
    };

    const patient = await findPatientIdBySub(cognitoSub(req));
    if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
    const patientId = patient.id;

    // If sourceConsultationId provided, verify it belongs to this patient
    if (sourceConsultationId) {
      const owned = await verifyConsultationOwnership(sourceConsultationId, patientId);
      if (!owned) {
        res.status(404).json({ error: "Source consultation not found" });
        return;
      }
    }

    const row = await insertRenewal(
      patientId,
      sourceConsultationId ?? null,
      medicationName.trim(),
      dosage ?? null,
      noAdverseEffects,
      conditionUnchanged,
      patientNotes ?? null,
      remindersEnabled
    );

    await insertRenewalRequestedAuditLog(patientId, row.id, medicationName);

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/renewals
// List the authenticated patient's renewal requests.
router.get("/", async (req, res, next) => {
  try {
    if (Array.isArray(req.query.limit) || Array.isArray(req.query.offset)) {
      res.status(400).json({ error: "limit and offset must be single values" });
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

    const patient = await findPatientIdBySub(cognitoSub(req));
    if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
    const patientId = patient.id;

    const [total, rows] = await Promise.all([
      countRenewalsByPatient(patientId),
      listRenewalsByPatient(patientId, limit, offset),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      medicationName: r.medication_name,
      dosage: r.dosage,
      reviewNote: r.review_note,
      validUntil: r.valid_until,
      remindersEnabled: r.reminders_enabled,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      doctorName: r.doctor_full_name ? `Dr ${r.doctor_full_name}` : null,
    }));

    res.json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DOCTOR ROUTES
// ---------------------------------------------------------------------------

// GET /api/v1/renewals/queue  (doctor only)
// Returns pending renewal requests for the doctor queue.
router.get("/queue", requireRole("doctor"), async (req, res, next) => {
  try {
    if (Array.isArray(req.query.limit) || Array.isArray(req.query.offset)) {
      res.status(400).json({ error: "limit and offset must be single values" });
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

    const [total, rows] = await Promise.all([
      countPendingRenewals(),
      listPendingRenewals(limit, offset),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      medicationName: r.medication_name,
      dosage: r.dosage,
      noAdverseEffects: r.no_adverse_effects,
      conditionUnchanged: r.condition_unchanged,
      patientNotes: r.patient_notes,
      createdAt: r.created_at,
      validUntil: r.valid_until,
      isExpiryAlert: !!r.alert_48h_sent_at,
      noPriorPrescriptionWarning: !r.source_consultation_id,
      patient: {
        name: r.patient_name,
        dob: r.patient_dob,
        sex: r.patient_sex,
      },
    }));

    res.json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/renewals/:id/approve  (doctor only)
router.post("/:id/approve", requireRole("doctor"), validateBody(ApproveRenewalSchema), async (req, res, next) => {
  try {
    const { reviewNote, validDays = 28 } = req.body as {
      reviewNote?: string;
      validDays?: number;
    };

    // SEC-005: Enforce maximum valid period
    const maxValidDays = parseInt(process.env.RENEWAL_MAX_VALID_DAYS ?? "90", 10);
    if (typeof validDays === "number" && validDays > maxValidDays) {
      res.status(400).json({
        error: `Valid period cannot exceed ${maxValidDays} days. Contact the Medical Director to extend this limit.`,
      });
      return;
    }

    const doctor = await findDoctorBySub(cognitoSub(req));
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

    const row = await approveRenewal(req.params.id, doctor.id, reviewNote ?? null, validDays);

    if (!row) {
      res.status(404).json({ error: "Renewal request not found or already reviewed" });
      return;
    }

    await insertRenewalApprovedAuditLog(
      doctor.id,
      doctor.ahpra_number,
      row.id,
      row.medication_name,
      row.valid_until,
      row.patient_id
    );

    // Fire-and-forget notification
    sendRenewalApprovedEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, renewalId: req.params.id }, "Failed to send renewal approval email")
    );

    res.json({
      id: row.id,
      status: row.status,
      validUntil: row.valid_until,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/renewals/:id/decline  (doctor only)
router.post("/:id/decline", requireRole("doctor"), validateBody(DeclineRenewalSchema), async (req, res, next) => {
  try {
    const { reviewNote } = req.body as { reviewNote?: string };

    const doctor = await findDoctorBySubForDecline(cognitoSub(req));
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

    const row = await declineRenewal(req.params.id, doctor.id, reviewNote ?? null);

    if (!row) {
      res.status(404).json({ error: "Renewal request not found or already reviewed" });
      return;
    }

    await insertRenewalDeclinedAuditLog(doctor.id, doctor.ahpra_number, row.id, row.medication_name);

    sendRenewalDeclinedEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, renewalId: req.params.id }, "Failed to send renewal declined email")
    );

    res.json({ id: row.id, status: row.status });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ADMIN / SYSTEM ROUTE
// POST /api/v1/renewals/expiry-check  (admin only — intended for scheduled trigger)
// Fires 48h doctor queue alerts and 7-day patient reminders.
// In production, called by a scheduled ECS task or EventBridge rule.
// ---------------------------------------------------------------------------
router.post("/expiry-check", requireRole("admin"), validateBody(z.object({})), async (_req, res, next) => {
  try {
    const expiring48h = await findRenewalsExpiring48h();

    for (const r of expiring48h) {
      await markAlert48hSent(r.id);
      await insertExpiryAlertAuditLog(r.patient_id, r.id, r.medication_name);
    }

    const expiring7d = await findRenewalsExpiring7d();

    for (const r of expiring7d) {
      await sendRenewalReminderEmail(r.id, pool).catch((err) =>
        logger.error({ err, renewalId: r.id }, "Failed to send renewal reminder email")
      );
      await markReminder7dSent(r.id);
      await insertPatientReminderAuditLog(r.patient_id, r.id, r.medication_name);
    }

    res.json({
      alerts48hSent: expiring48h.length,
      reminders7dSent: expiring7d.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
