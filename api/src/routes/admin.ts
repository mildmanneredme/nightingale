import { Router, RequestHandler } from "express";
import { createHash } from "crypto";
import { validateBody } from "../middleware/validate";
import { ReassignConsultationSchema } from "../schemas/followup.schema";
import {
  findDoctorById,
  findConsultationAssignment,
  reassignConsultation,
  insertReassignAuditLog,
  findQueuedConsultations,
  findAllDoctors,
  findAdminStats,
  findAvgReviewTime,
  findFollowUpStats,
} from "../repositories/admin.repository";

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
router.post("/consultations/:id/reassign", validateBody(ReassignConsultationSchema), async (req, res, next) => {
  try {
    const { doctorId } = req.body;

    // Verify doctor exists
    const doctorRow = await findDoctorById(doctorId);
    if (!doctorRow) {
      res.status(400).json({ error: "Doctor not found" });
      return;
    }

    // Fetch current assignment for audit log
    const consultRow = await findConsultationAssignment(req.params.id);
    if (!consultRow) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    const previousDoctorId = consultRow.assigned_doctor_id;

    const row = await reassignConsultation(req.params.id, doctorId);

    const adminSub = cognitoSub(req);
    await insertReassignAuditLog(subToUuid(adminSub), req.params.id, doctorId, previousDoctorId, adminSub);

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/queue  — all queued_for_review consultations
// ---------------------------------------------------------------------------
router.get("/queue", async (_req, res, next) => {
  try {
    const rows = await findQueuedConsultations();

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
    const rows = await findAllDoctors();
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
    const t = await findAdminStats();
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

    const reviewTime = await findAvgReviewTime();
    const followup = await findFollowUpStats();

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
        avgReviewMinutes: reviewTime.avg_minutes ? parseInt(reviewTime.avg_minutes) : null,
      },
      followUp: {
        sent: parseInt(followup.sent),
        responded: parseInt(followup.responded),
        better: parseInt(followup.better),
        same: parseInt(followup.same),
        worse: parseInt(followup.worse),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
