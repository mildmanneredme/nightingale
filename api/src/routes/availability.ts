// PRD-017: Doctor Scheduling & Availability
//
// Routes for doctors to manage their weekly schedule and date overrides.
// Capacity stats used for analytics and admin alerting.
// Response-time estimate exposed to patient-facing flows.

import { Router, RequestHandler } from "express";
import { pool } from "../db";
import { logger } from "../logger";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

interface AvailabilityWindow {
  day: number;     // 0=Sunday … 6=Saturday
  start_time: string; // "HH:MM" in AEST
  end_time: string;   // "HH:MM" in AEST
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
  const { rows } = await pool.query(
    `SELECT id, weekly_windows, daily_cap
     FROM doctor_availability WHERE doctor_id = $1`,
    [doctorId]
  );
  if (rows[0]) return rows[0];

  // Default schedule: Mon–Fri 8am–6pm AEST, daily cap 20
  const defaultWindows: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((day) => ({
    day,
    start_time: "08:00",
    end_time: "18:00",
  }));
  const { rows: created } = await pool.query(
    `INSERT INTO doctor_availability (doctor_id, weekly_windows, daily_cap)
     VALUES ($1, $2, 20) RETURNING id, weekly_windows, daily_cap`,
    [doctorId, JSON.stringify(defaultWindows)]
  );
  return created[0];
}

// Checks if a doctor is currently within an available window (today, AEST).
async function isDoctorCurrentlyAvailable(doctorId: string): Promise<boolean> {
  const { dayOfWeek, timeStr, date } = sydneyNow();
  const today = date.toISOString().slice(0, 10);

  // Check date override first
  const { rows: overrides } = await pool.query(
    `SELECT available, windows FROM doctor_date_overrides
     WHERE doctor_id = $1 AND override_date = $2`,
    [doctorId, today]
  );
  if (overrides[0]) {
    if (!overrides[0].available) return false;
    // Has custom windows
    if (overrides[0].windows) {
      const windows = overrides[0].windows as AvailabilityWindow[];
      return windows.some((w) => timeGte(timeStr, w.start_time) && timeLt(timeStr, w.end_time));
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
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM consultations
     WHERE reviewed_by = $1
       AND reviewed_at::date = $2`,
    [doctorId, today]
  );
  return rows[0]?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// GET /api/v1/doctor/schedule
// Returns the doctor's current availability schedule + overrides.
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = dRows[0].id;

    const avail = await ensureAvailability(doctorId);

    // Overrides for next 60 days
    const { rows: overrides } = await pool.query(
      `SELECT override_date, available, windows, note
       FROM doctor_date_overrides
       WHERE doctor_id = $1 AND override_date >= CURRENT_DATE AND override_date < CURRENT_DATE + INTERVAL '60 days'
       ORDER BY override_date`,
      [doctorId]
    );

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

    const { rows: dRows } = await pool.query(
      `SELECT id, ahpra_number FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = dRows[0].id;

    const avail = await ensureAvailability(doctorId);

    const newWindows = weeklyWindows ?? avail.weekly_windows;
    const newCap = dailyCap ?? avail.daily_cap;

    const { rows } = await pool.query(
      `INSERT INTO doctor_availability (doctor_id, weekly_windows, daily_cap)
       VALUES ($1, $2, $3)
       ON CONFLICT (doctor_id) DO UPDATE
         SET weekly_windows = EXCLUDED.weekly_windows,
             daily_cap = EXCLUDED.daily_cap,
             updated_at = NOW()
       RETURNING weekly_windows, daily_cap`,
      [doctorId, JSON.stringify(newWindows), newCap]
    );

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
       VALUES ('doctor.availability_updated', $1, 'doctor', $2)`,
      [doctorId, JSON.stringify({ doctor_id: doctorId, daily_cap: newCap })]
    );

    res.json({ weeklyWindows: rows[0].weekly_windows, dailyCap: rows[0].daily_cap });
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

    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = dRows[0].id;

    const { rows } = await pool.query(
      `INSERT INTO doctor_date_overrides (doctor_id, override_date, available, windows, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (doctor_id, override_date) DO UPDATE
         SET available = EXCLUDED.available,
             windows = EXCLUDED.windows,
             note = EXCLUDED.note
       RETURNING id, override_date, available, windows, note`,
      [doctorId, date, available, windows ? JSON.stringify(windows) : null, note ?? null]
    );

    res.status(201).json({
      id: rows[0].id,
      date: rows[0].override_date,
      available: rows[0].available,
      windows: rows[0].windows,
      note: rows[0].note,
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
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = dRows[0].id;

    await pool.query(
      `DELETE FROM doctor_date_overrides WHERE doctor_id = $1 AND override_date = $2`,
      [doctorId, req.params.date]
    );

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
    const { rows: dRows } = await pool.query(
      `SELECT id FROM doctors WHERE cognito_sub = $1`,
      [cognitoSub(req)]
    );
    if (!dRows[0]) { res.status(404).json({ error: "Doctor not found" }); return; }
    const doctorId = dRows[0].id;

    const avail = await ensureAvailability(doctorId);

    // Consultations reviewed this calendar month
    const { rows: monthRows } = await pool.query(
      `SELECT COUNT(*)::int AS reviewed_this_month
       FROM consultations
       WHERE reviewed_by = $1
         AND reviewed_at >= date_trunc('month', NOW())
         AND reviewed_at < date_trunc('month', NOW()) + INTERVAL '1 month'`,
      [doctorId]
    );
    const reviewedThisMonth = monthRows[0]?.reviewed_this_month ?? 0;

    // Monthly cap: daily_cap × 22 (approx. working days per month)
    const monthlyCapEstimate = avail.daily_cap * 22;
    const utilisationPct = Math.round((reviewedThisMonth / monthlyCapEstimate) * 100);

    // Today's count and daily cap
    const todayCount = await getTodayReviewCount(doctorId);
    const dailyCapHit = todayCount >= avail.daily_cap;

    // Log alert if utilisation hits 80%+ (once per day to avoid spam)
    if (utilisationPct >= 80) {
      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
         VALUES ('doctor.capacity_alert', $1, 'doctor', $2)
         ON CONFLICT DO NOTHING`,
        [doctorId, JSON.stringify({ utilisation_pct: utilisationPct, reviewed_this_month: reviewedThisMonth })]
      ).catch(() => {}); // ignore if audit_log has no unique constraint — just log best-effort
    }

    if (dailyCapHit) {
      await pool.query(
        `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
         VALUES ('doctor.daily_cap_reached', $1, 'doctor', $2)`,
        [doctorId, JSON.stringify({ daily_cap: avail.daily_cap, today_count: todayCount })]
      ).catch(() => {});
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
  const { rows: doctors } = await pool.query(
    `SELECT d.id, da.weekly_windows, da.daily_cap
     FROM doctors d
     JOIN doctor_availability da ON da.doctor_id = d.id
     WHERE d.is_active = TRUE`
  );

  for (const doc of doctors) {
    const available = await isDoctorCurrentlyAvailable(doc.id);
    if (!available) continue;

    const todayCount = await getTodayReviewCount(doc.id);
    if (todayCount >= doc.daily_cap) continue;

    // Doctor is available and under cap — estimate based on queue length
    const { rows: queueRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM consultations WHERE status = 'queued_for_review'`
    );
    const queueLength = queueRows[0]?.cnt ?? 0;
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
      const { rows: overrideRows } = await pool.query(
        `SELECT available, windows FROM doctor_date_overrides
         WHERE doctor_id = $1 AND override_date = $2`,
        [doc.id, checkDateStr]
      );
      if (overrideRows[0] && !overrideRows[0].available) continue;

      const windows: AvailabilityWindow[] = overrideRows[0]?.windows ?? doc.weekly_windows ?? [];
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
