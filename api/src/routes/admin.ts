import { Router, RequestHandler } from "express";
import { createHash } from "crypto";
import { pool } from "../db";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// Converts any string to a deterministic UUID v3-style using MD5.
// Admins don't have a DB row, so we derive a stable UUID from their cognito sub.
function subToUuid(sub: string): string {
  const h = createHash("md5").update(sub).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

// ---------------------------------------------------------------------------
// POST /consultations/:id/reassign
// ---------------------------------------------------------------------------
router.post("/consultations/:id/reassign", async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      res.status(400).json({ error: "doctorId is required" });
      return;
    }

    // Verify doctor exists
    const { rows: doctorRows } = await pool.query(
      `SELECT id FROM doctors WHERE id = $1`,
      [doctorId]
    );
    if (!doctorRows[0]) {
      res.status(400).json({ error: "Doctor not found" });
      return;
    }

    // Fetch current assignment for audit log
    const { rows: consultRows } = await pool.query(
      `SELECT id, assigned_doctor_id FROM consultations WHERE id = $1`,
      [req.params.id]
    );
    if (!consultRows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    const previousDoctorId = consultRows[0].assigned_doctor_id;

    const { rows } = await pool.query(
      `UPDATE consultations
       SET assigned_doctor_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, assigned_doctor_id AS "assignedDoctorId"`,
      [doctorId, req.params.id]
    );

    const adminSub = cognitoSub(req);
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.reassigned', $1, 'admin', $2, $3)`,
      [
        subToUuid(adminSub),
        req.params.id,
        JSON.stringify({ doctorId, previousDoctorId, adminSub }),
      ]
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/queue  — all queued_for_review consultations
// ---------------------------------------------------------------------------
router.get("/queue", async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      presenting_complaint: string | null;
      assigned_doctor_id: string | null;
      doctor_name: string | null;
      created_at: string;
      queued_at: string;
    }>(
      `SELECT
         c.id,
         p.first_name,
         p.last_name,
         c.presenting_complaint,
         c.assigned_doctor_id,
         COALESCE(d.first_name || ' ' || d.last_name, NULL) AS doctor_name,
         c.created_at,
         c.updated_at AS queued_at
       FROM consultations c
       LEFT JOIN patients p ON p.id = c.patient_id
       LEFT JOIN doctors d ON d.id = c.assigned_doctor_id
       WHERE c.status = 'queued_for_review'
       ORDER BY c.updated_at ASC`
    );

    const items = rows.map((r) => {
      const first = r.first_name ?? "";
      const last = r.last_name ?? "";
      const initials =
        (first[0] ?? "").toUpperCase() + (last[0] ?? "").toUpperCase() || "?";
      return {
        id: r.id,
        patientInitials: initials,
        presentingComplaint: r.presenting_complaint,
        assignedDoctorId: r.assigned_doctor_id,
        assignedDoctorName: r.doctor_name,
        createdAt: r.created_at,
        queuedAt: r.queued_at,
      };
    });

    res.json(items);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/doctors  — list of all active doctors
// ---------------------------------------------------------------------------
router.get("/doctors", async (_req, res, next) => {
  try {
    const { rows } = await pool.query<{ id: string; first_name: string; last_name: string }>(
      `SELECT id, first_name, last_name FROM doctors ORDER BY last_name, first_name`
    );
    res.json(rows.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}` })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/stats  (admin — beta launch dashboard)
// Returns patient counts, consultation counts, and approval/amendment/rejection rates.
// ---------------------------------------------------------------------------
router.get("/stats", async (_req, res, next) => {
  try {
    const { rows: totals } = await pool.query<{
      total_patients: string;
      total_consultations: string;
      pending_consultations: string;
      approved_consultations: string;
      amended_consultations: string;
      rejected_consultations: string;
      emergency_escalated: string;
      cannot_assess: string;
      resolved_consultations: string;
      followup_concern: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM patients)                                                AS total_patients,
         (SELECT COUNT(*) FROM consultations)                                           AS total_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'queued_for_review')        AS pending_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'approved')                 AS approved_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'amended')                  AS amended_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'rejected')                 AS rejected_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'emergency_escalated')      AS emergency_escalated,
         (SELECT COUNT(*) FROM consultations WHERE status = 'cannot_assess')            AS cannot_assess,
         (SELECT COUNT(*) FROM consultations WHERE status IN ('resolved','unchanged'))  AS resolved_consultations,
         (SELECT COUNT(*) FROM consultations WHERE status = 'followup_concern')         AS followup_concern`
    );

    const t = totals[0];
    const reviewed =
      parseInt(t.approved_consultations) +
      parseInt(t.amended_consultations) +
      parseInt(t.rejected_consultations);

    const approvalRate = reviewed > 0
      ? Math.round((parseInt(t.approved_consultations) / reviewed) * 100)
      : null;
    const amendmentRate = reviewed > 0
      ? Math.round((parseInt(t.amended_consultations) / reviewed) * 100)
      : null;
    const rejectionRate = reviewed > 0
      ? Math.round((parseInt(t.rejected_consultations) / reviewed) * 100)
      : null;

    // Average doctor review time (reviewed_at - queued_for_review transition)
    const { rows: reviewTime } = await pool.query<{ avg_minutes: string | null }>(
      `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 60))::text AS avg_minutes
       FROM consultations
       WHERE reviewed_at IS NOT NULL`
    );

    // Follow-up outcomes
    const { rows: followup } = await pool.query<{
      sent: string;
      responded: string;
      better: string;
      same: string;
      worse: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE followup_sent_at IS NOT NULL)           AS sent,
         COUNT(*) FILTER (WHERE followup_response IS NOT NULL)          AS responded,
         COUNT(*) FILTER (WHERE followup_response = 'better')           AS better,
         COUNT(*) FILTER (WHERE followup_response = 'same')             AS same,
         COUNT(*) FILTER (WHERE followup_response = 'worse')            AS worse
       FROM consultations`
    );

    res.json({
      patients: {
        total: parseInt(t.total_patients),
      },
      consultations: {
        total: parseInt(t.total_consultations),
        pending: parseInt(t.pending_consultations),
        approved: parseInt(t.approved_consultations),
        amended: parseInt(t.amended_consultations),
        rejected: parseInt(t.rejected_consultations),
        emergencyEscalated: parseInt(t.emergency_escalated),
        cannotAssess: parseInt(t.cannot_assess),
        resolved: parseInt(t.resolved_consultations),
        followupConcern: parseInt(t.followup_concern),
      },
      rates: {
        approvalPct: approvalRate,
        amendmentPct: amendmentRate,
        rejectionPct: rejectionRate,
        avgReviewMinutes: reviewTime[0].avg_minutes ? parseInt(reviewTime[0].avg_minutes) : null,
      },
      followUp: {
        sent: parseInt(followup[0].sent),
        responded: parseInt(followup[0].responded),
        better: parseInt(followup[0].better),
        same: parseInt(followup[0].same),
        worse: parseInt(followup[0].worse),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
