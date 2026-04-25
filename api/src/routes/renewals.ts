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
import { pool } from "../db";
import { requireRole } from "../middleware/auth";
import { sendRenewalApprovedEmail, sendRenewalDeclinedEmail, sendRenewalReminderEmail } from "../services/emailService";
import { logger } from "../logger";
import { validateBody } from "../middleware/validate";
import {
  CreateRenewalSchema,
  ApproveRenewalSchema,
  DeclineRenewalSchema,
} from "../schemas/renewal.schema";

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

    const { rows: pRows } = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!pRows[0]) { res.status(404).json({ error: "Patient not found" }); return; }
    const patientId = pRows[0].id;

    // If sourceConsultationId provided, verify it belongs to this patient
    if (sourceConsultationId) {
      const { rows: cRows } = await pool.query(
        `SELECT id FROM consultations WHERE id = $1 AND patient_id = $2`,
        [sourceConsultationId, patientId]
      );
      if (!cRows[0]) {
        res.status(404).json({ error: "Source consultation not found" });
        return;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO renewal_requests
         (patient_id, source_consultation_id, medication_name, dosage,
          no_adverse_effects, condition_unchanged, patient_notes, reminders_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, status, medication_name, dosage, created_at`,
      [patientId, sourceConsultationId ?? null, medicationName.trim(), dosage ?? null,
       noAdverseEffects, conditionUnchanged, patientNotes ?? null, remindersEnabled]
    );

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
       VALUES ('renewal.requested', $1, 'patient', $2)`,
      [patientId, JSON.stringify({ renewal_id: rows[0].id, medication: medicationName })]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/renewals
// List the authenticated patient's renewal requests.
router.get("/", async (req, res, next) => {
  try {
    const { rows: pRows } = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!pRows[0]) { res.status(404).json({ error: "Patient not found" }); return; }
    const patientId = pRows[0].id;

    const { rows } = await pool.query(
      `SELECT r.id, r.status, r.medication_name, r.dosage, r.no_adverse_effects,
              r.condition_unchanged, r.patient_notes, r.reminders_enabled,
              r.review_note, r.valid_until, r.created_at, r.reviewed_at,
              d.first_name AS doctor_first_name, d.last_name AS doctor_last_name
       FROM renewal_requests r
       LEFT JOIN doctors d ON d.id = r.reviewed_by
       WHERE r.patient_id = $1
       ORDER BY r.created_at DESC`,
      [patientId]
    );

    res.json(rows.map((r) => ({
      id: r.id,
      status: r.status,
      medicationName: r.medication_name,
      dosage: r.dosage,
      reviewNote: r.review_note,
      validUntil: r.valid_until,
      remindersEnabled: r.reminders_enabled,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      doctorName: r.doctor_last_name ? `Dr ${r.doctor_last_name}` : null,
    })));
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
    const { rows } = await pool.query(
      `SELECT r.id, r.status, r.medication_name, r.dosage,
              r.no_adverse_effects, r.condition_unchanged, r.patient_notes,
              r.created_at, r.valid_until, r.alert_48h_sent_at,
              r.source_consultation_id,
              p.full_name AS patient_name, p.date_of_birth AS patient_dob,
              p.biological_sex AS patient_sex
       FROM renewal_requests r
       JOIN patients p ON p.id = r.patient_id
       WHERE r.status = 'pending'
       ORDER BY
         -- Expiry alerts first
         CASE WHEN r.alert_48h_sent_at IS NOT NULL THEN 0 ELSE 1 END,
         r.created_at ASC`
    );

    res.json(rows.map((r) => ({
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
    })));
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

    const { rows: dRows } = await pool.query(
      `SELECT id, ahpra_number, first_name, last_name FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctor = dRows[0];

    const { rows } = await pool.query(
      `UPDATE renewal_requests
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_note = $2,
           valid_until = (NOW() + ($3 || ' days')::INTERVAL)::DATE,
           updated_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING id, status, patient_id, medication_name, dosage, valid_until`,
      [doctor.id, reviewNote ?? null, validDays, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Renewal request not found or already reviewed" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
       VALUES ('renewal.approved', $1, 'doctor', $2, $3)`,
      [doctor.id, doctor.ahpra_number,
       JSON.stringify({
         renewal_id: rows[0].id,
         medication: rows[0].medication_name,
         valid_until: rows[0].valid_until,
         patient_id: rows[0].patient_id,
       })]
    );

    // Fire-and-forget notification
    sendRenewalApprovedEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, renewalId: req.params.id }, "Failed to send renewal approval email")
    );

    res.json({
      id: rows[0].id,
      status: rows[0].status,
      validUntil: rows[0].valid_until,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/renewals/:id/decline  (doctor only)
router.post("/:id/decline", requireRole("doctor"), validateBody(DeclineRenewalSchema), async (req, res, next) => {
  try {
    const { reviewNote } = req.body as { reviewNote?: string };

    const { rows: dRows } = await pool.query(
      `SELECT id, ahpra_number FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctor = dRows[0];

    const { rows } = await pool.query(
      `UPDATE renewal_requests
       SET status = 'declined',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_note = $2,
           updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING id, status, patient_id, medication_name`,
      [doctor.id, reviewNote ?? null, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Renewal request not found or already reviewed" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, ahpra_number, metadata)
       VALUES ('renewal.declined', $1, 'doctor', $2, $3)`,
      [doctor.id, doctor.ahpra_number,
       JSON.stringify({ renewal_id: rows[0].id, medication: rows[0].medication_name })]
    );

    sendRenewalDeclinedEmail(req.params.id, pool).catch((err) =>
      logger.error({ err, renewalId: req.params.id }, "Failed to send renewal declined email")
    );

    res.json({ id: rows[0].id, status: rows[0].status });
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
router.post("/expiry-check", requireRole("admin"), async (_req, res, next) => {
  try {
    // 48h alert: approved renewals expiring within 48 hours where alert not yet sent
    const { rows: expiring48h } = await pool.query(
      `SELECT id, patient_id, medication_name
       FROM renewal_requests
       WHERE status = 'approved'
         AND valid_until IS NOT NULL
         AND valid_until <= (NOW() + INTERVAL '48 hours')::DATE
         AND valid_until >= CURRENT_DATE
         AND alert_48h_sent_at IS NULL`
    );

    for (const r of expiring48h) {
      await pool.query(
        `UPDATE renewal_requests SET alert_48h_sent_at = NOW() WHERE id = $1`,
        [r.id]
      );
      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
         VALUES ('renewal.expiry_alert_sent', $1, 'patient', $2)`,
        [r.patient_id, JSON.stringify({ renewal_id: r.id, medication: r.medication_name })]
      );
    }

    // 7-day reminder: send patient reminder for renewals expiring within 7 days
    const { rows: expiring7d } = await pool.query(
      `SELECT id, patient_id, medication_name
       FROM renewal_requests
       WHERE status = 'approved'
         AND valid_until IS NOT NULL
         AND valid_until <= (NOW() + INTERVAL '7 days')::DATE
         AND valid_until > (NOW() + INTERVAL '48 hours')::DATE
         AND reminder_7d_sent_at IS NULL
         AND reminders_enabled = TRUE`
    );

    for (const r of expiring7d) {
      await sendRenewalReminderEmail(r.id, pool).catch((err) =>
        logger.error({ err, renewalId: r.id }, "Failed to send renewal reminder email")
      );
      await pool.query(
        `UPDATE renewal_requests SET reminder_7d_sent_at = NOW() WHERE id = $1`,
        [r.id]
      );
      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
         VALUES ('renewal.patient_reminder_sent', $1, 'patient', $2)`,
        [r.patient_id, JSON.stringify({ renewal_id: r.id, medication: r.medication_name })]
      );
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
