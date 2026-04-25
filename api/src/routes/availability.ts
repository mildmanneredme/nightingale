// PRD-017: Doctor Scheduling & Availability
//
// Routes for doctors to manage their weekly schedule and date overrides.
// Capacity stats used for analytics and admin alerting.
// Response-time estimate exposed to patient-facing flows.

import { Router, RequestHandler } from "express";
import { logger } from "../logger";
import {
  AvailabilityWindow,
  findAvailabilityByDoctor,
  insertDefaultAvailability,
  findDateOverride,
  countTodayReviews,
  findDoctorIdBySub,
  findDoctorIdAndAhpraNumberBySub,
  listUpcomingDateOverrides,
  upsertAvailability,
  insertAvailabilityUpdatedAuditLog,
  upsertDateOverride,
  deleteDateOverride,
  countMonthlyReviews,
  insertCapacityAlertAuditLog,
  insertDailyCapReachedAuditLog,
  findAllActiveDoctorsWithAvailability,
  countQueuedConsultations,
} from "../repositories/availability.repository";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// Australia/Sydney is UTC+10 (AEST) or UTC+11 (AEDT, last Sun Oct – first Sun Apr).
// For internal UTC conversion we use a simple offset. DST boundaries are handled by
// comparing the current Sydney date via Intl.DateTimeFormat.
function sydneyNow(): { date: Date; dayOfWeek: number; timeStr: string } {
  const now = new Date();
  const sydneyStr = now.toLocaleString("en-AU", { timeZone: "Australia/Sydney" });
  const sydneyDate = new Date(sydneyStr);
  const h = sydneyDate.getHours();
  const m = sydneyDate.getMinutes();
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const dayOfWeek = sydneyDate.getDay();
  return { date: sydneyDate, dayOfWeek, timeStr };
}

function timeLt(a: string, b: string): boolean {
  return a < b; // "HH:MM" string comparison is valid for same-day comparisons
}

function timeGte(a: string, b: string): boolean {
  return a >= b;
}

// Returns the doctor's active availability row, creating a default if none exists.
async function ensureAvailability(doctorId: string) {
  const existing = await findAvailabilityByDoctor(doctorId);
  if (existing) return existing;

  // Default schedule: Mon–Fri 8am–6pm AEST, daily cap 20
  const defaultWindows: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((day) => ({
    day,
    start_time: "08:00",
    end_time: "18:00",
  }));
  return insertDefaultAvailability(doctorId, defaultWindows);
}

// Checks if a doctor is currently within an available window (today, AEST).
async function isDoctorCurrentlyAvailable(doctorId: string): Promise<boolean> {
  const { dayOfWeek, timeStr, date } = sydneyNow();
  const today = date.toISOString().slice(0, 10);

  // Check date override first
  const override = await findDateOverride(doctorId, today);
  if (override) {
    if (!override.available) return false;
    // Has custom windows
    if (override.windows) {
      return override.windows.some((w) => timeGte(timeStr, w.start_time) && timeLt(timeStr, w.end_time));
    }
  }

  // Fall back to weekly schedule
  const avail = await ensureAvailability(doctorId);
  const windows = (avail.weekly_windows ?? []) as AvailabilityWindow[];
  return windows.some(
    (w) => w.day === dayOfWeek && timeGte(timeStr, w.start_time) && timeLt(timeStr, w.end_time)
  );
}

// Returns today's consultation count for a doctor (reviews submitted today in Sydney time).
async function getTodayReviewCount(doctorId: string): Promise<number> {
  const { date } = sydneyNow();
  const today = date.toISOString().slice(0, 10);
  return countTodayReviews(doctorId, today);
}

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/schedule
// Returns the doctor's current availability schedule + overrides.
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const doctorRow = await findDoctorIdBySub(cognitoSub(req));
    if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = doctorRow.id;

    const avail = await ensureAvailability(doctorId);
    const overrides = await listUpcomingDateOverrides(doctorId);

    res.json({
      weeklyWindows: avail.weekly_windows,
      dailyCap: avail.daily_cap,
      overrides: overrides.map((o) => ({
        date: o.override_date,
        available: o.available,
        windows: o.windows,
        note: o.note,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/v1/doctor/schedule
// Update weekly windows and/or daily cap.
// ---------------------------------------------------------------------------
router.put("/", async (req, res, next) => {
  try {
    const { weeklyWindows, dailyCap } = req.body as {
      weeklyWindows?: AvailabilityWindow[];
      dailyCap?: number;
    };

    if (weeklyWindows !== undefined && !Array.isArray(weeklyWindows)) {
      res.status(400).json({ error: "weeklyWindows must be an array" });
      return;
    }
    if (dailyCap !== undefined && (typeof dailyCap !== "number" || dailyCap < 1 || dailyCap > 100)) {
      res.status(400).json({ error: "dailyCap must be between 1 and 100" });
      return;
    }

    const doctorRow = await findDoctorIdAndAhpraNumberBySub(cognitoSub(req));
    if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = doctorRow.id;

    const avail = await ensureAvailability(doctorId);

    const newWindows = weeklyWindows ?? avail.weekly_windows;
    const newCap = dailyCap ?? avail.daily_cap;

    const updated = await upsertAvailability(doctorId, newWindows, newCap);
    await insertAvailabilityUpdatedAuditLog(doctorId, newCap);

    res.json({ weeklyWindows: updated.weekly_windows, dailyCap: updated.daily_cap });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/doctor/schedule/overrides
// Add or update a date override.
// ---------------------------------------------------------------------------
router.post("/overrides", async (req, res, next) => {
  try {
    const { date, available, windows, note } = req.body as {
      date: string;
      available: boolean;
      windows?: AvailabilityWindow[];
      note?: string;
    };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
      return;
    }
    if (typeof available !== "boolean") {
      res.status(400).json({ error: "available (boolean) is required" });
      return;
    }

    const doctorRow = await findDoctorIdBySub(cognitoSub(req));
    if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = doctorRow.id;

    const row = await upsertDateOverride(doctorId, date, available, windows ?? null, note ?? null);

    res.status(201).json({
      id: row.id,
      date: row.override_date,
      available: row.available,
      windows: row.windows,
      note: row.note,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/doctor/schedule/overrides/:date
// Remove a date override (revert to weekly schedule).
// ---------------------------------------------------------------------------
router.delete("/overrides/:date", async (req, res, next) => {
  try {
    const doctorRow = await findDoctorIdBySub(cognitoSub(req));
    if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

    await deleteDateOverride(doctorRow.id, req.params.date);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/schedule/capacity
// Monthly capacity utilisation for the authenticated doctor.
// ---------------------------------------------------------------------------
router.get("/capacity", async (req, res, next) => {
  try {
    const doctorRow = await findDoctorIdBySub(cognitoSub(req));
    if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = doctorRow.id;

    const avail = await ensureAvailability(doctorId);

    const reviewedThisMonth = await countMonthlyReviews(doctorId);

    // Monthly cap: daily_cap × 22 (approx. working days per month)
    const monthlyCapEstimate = avail.daily_cap * 22;
    const utilisationPct = Math.round((reviewedThisMonth / monthlyCapEstimate) * 100);

    // Today's count and daily cap
    const todayCount = await getTodayReviewCount(doctorId);
    const dailyCapHit = todayCount >= avail.daily_cap;

    // Log alert if utilisation hits 80%+ (once per day to avoid spam)
    if (utilisationPct >= 80) {
      await insertCapacityAlertAuditLog(doctorId, utilisationPct, reviewedThisMonth);
    }

    if (dailyCapHit) {
      await insertDailyCapReachedAuditLog(doctorId, avail.daily_cap, todayCount);
    }

    res.json({
      reviewedThisMonth,
      monthlyCapEstimate,
      utilisationPct,
      dailyCap: avail.daily_cap,
      todayReviewCount: todayCount,
      dailyCapHit,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/availability/response-time  (public — called from patient booking flow)
// Returns estimated response time based on next available doctor slot.
// ---------------------------------------------------------------------------
export async function getResponseTimeEstimate(): Promise<{
  available: boolean;
  estimatedResponseText: string;
  nextSlotAt: string | null;
}> {
  // Fetch all active doctors with their availability
  const doctors = await findAllActiveDoctorsWithAvailability();

  for (const doc of doctors) {
    const available = await isDoctorCurrentlyAvailable(doc.id);
    if (!available) continue;

    const todayCount = await getTodayReviewCount(doc.id);
    if (todayCount >= doc.daily_cap) continue;

    // Doctor is available and under cap — estimate based on queue length
    const queueLength = await countQueuedConsultations();
    const minutesPerReview = 10;
    const estimatedMins = Math.max(30, queueLength * minutesPerReview);
    const hours = Math.ceil(estimatedMins / 60);

    return {
      available: true,
      estimatedResponseText: hours <= 1
        ? "Typical wait time: within 1 hour"
        : `Typical wait time: within ${hours} hours`,
      nextSlotAt: null,
    };
  }

  // No doctor currently available — find next available slot
  // Check each doctor's upcoming windows for the next 7 days
  const { dayOfWeek, date: sydDate } = sydneyNow();
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const checkDate = new Date(sydDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const checkDay = checkDate.getDay();
    const checkDateStr = checkDate.toISOString().slice(0, 10);

    for (const doc of doctors) {
      // Check override
      const override = await findDateOverride(doc.id, checkDateStr);
      if (override && !override.available) continue;

      const windows: AvailabilityWindow[] = override?.windows ?? doc.weekly_windows ?? [];
      const dayWindows = windows.filter((w) => w.day === checkDay);

      for (const w of dayWindows) {
        const slotTime = `${checkDateStr}T${w.start_time}:00+10:00`;
        const slotDate = new Date(slotTime);
        if (slotDate > new Date()) {
          const formatted = slotDate.toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return {
            available: false,
            estimatedResponseText: `Response expected by ${formatted} AEST`,
            nextSlotAt: slotDate.toISOString(),
          };
        }
      }
    }
  }

  // Fallback
  return {
    available: false,
    estimatedResponseText: "Response expected within 24 hours",
    nextSlotAt: null,
  };
}

export default router;
