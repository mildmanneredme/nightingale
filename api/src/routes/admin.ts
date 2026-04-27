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
import {
  getUsageSummary,
  getUsageByModel,
  getUsageByOperation,
  getUsageByConsultation,
  countConsultationsWithUsage,
  getUsageDaily,
  getUsageForConsultation,
} from "../repositories/llmUsage.repository";

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

// ---------------------------------------------------------------------------
// LLM cost dashboard endpoints
// All cost values returned as USD (string, 6 decimal places) for client display.
// ---------------------------------------------------------------------------

function microsToUsd(micros: string | number): string {
  const n = typeof micros === "string" ? parseInt(micros, 10) : micros;
  return (n / 1_000_000).toFixed(6);
}

function parseRange(req: { query: Record<string, unknown> }): { from?: string; to?: string } {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  return { from, to };
}

router.get("/llm-usage/summary", async (req, res, next) => {
  try {
    const range = parseRange(req);
    const [summary, byModel, byOperation, daily] = await Promise.all([
      getUsageSummary(range),
      getUsageByModel(range),
      getUsageByOperation(range),
      getUsageDaily(range),
    ]);

    res.json({
      totals: {
        calls: parseInt(summary.total_calls, 10),
        inputTokens: parseInt(summary.total_input_tokens, 10),
        outputTokens: parseInt(summary.total_output_tokens, 10),
        cacheReadTokens: parseInt(summary.total_cache_read_tokens, 10),
        cacheWriteTokens: parseInt(summary.total_cache_write_tokens, 10),
        costUsd: microsToUsd(summary.total_cost_micros),
      },
      byModel: byModel.map((r) => ({
        provider: r.provider,
        modelId: r.model_id,
        callCount: parseInt(r.call_count, 10),
        inputTokens: parseInt(r.input_tokens, 10),
        outputTokens: parseInt(r.output_tokens, 10),
        cacheReadTokens: parseInt(r.cache_read_tokens, 10),
        costUsd: microsToUsd(r.cost_micros),
      })),
      byOperation: byOperation.map((r) => ({
        operation: r.operation,
        callCount: parseInt(r.call_count, 10),
        costUsd: microsToUsd(r.cost_micros),
      })),
      daily: daily.map((r) => ({
        day: r.day,
        callCount: parseInt(r.call_count, 10),
        costUsd: microsToUsd(r.cost_micros),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/llm-usage/by-consultation", async (req, res, next) => {
  try {
    const range = parseRange(req);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    const [rows, total] = await Promise.all([
      getUsageByConsultation(range, limit, offset),
      countConsultationsWithUsage(range),
    ]);

    res.json({
      data: rows.map((r) => ({
        consultationId: r.consultation_id,
        callCount: parseInt(r.call_count, 10),
        costUsd: microsToUsd(r.cost_micros),
        inputTokens: parseInt(r.input_tokens, 10),
        outputTokens: parseInt(r.output_tokens, 10),
        firstCallAt: r.first_call_at,
        lastCallAt: r.last_call_at,
        presentingComplaint: r.presenting_complaint,
        consultationType: r.consultation_type,
        status: r.status,
      })),
      pagination: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/llm-usage/consultation/:id", async (req, res, next) => {
  try {
    const rows = await getUsageForConsultation(req.params.id);
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        operation: r.operation,
        provider: r.provider,
        modelId: r.model_id,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        costUsd: microsToUsd(r.cost_usd_micros),
        createdAt: r.created_at,
        metadata: r.metadata,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
