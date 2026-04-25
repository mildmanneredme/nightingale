import { pool } from "../db";

export interface AvailabilityWindow {
  day: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilityRow {
  id: string;
  weekly_windows: AvailabilityWindow[];
  daily_cap: number;
}

export interface DateOverrideRow {
  id: string;
  override_date: string;
  available: boolean;
  windows: AvailabilityWindow[] | null;
  note: string | null;
}

export interface DoctorIdRow {
  id: string;
}

export interface DoctorWithAvailabilityRow {
  id: string;
  weekly_windows: AvailabilityWindow[];
  daily_cap: number;
}

export interface QueueCountRow {
  cnt: number;
}

export async function findAvailabilityByDoctor(doctorId: string): Promise<AvailabilityRow | undefined> {
  const { rows } = await pool.query<AvailabilityRow>(
    `SELECT id, weekly_windows, daily_cap
     FROM doctor_availability WHERE doctor_id = $1`,
    [doctorId]
  );
  return rows[0];
}

export async function insertDefaultAvailability(doctorId: string, defaultWindows: AvailabilityWindow[]): Promise<AvailabilityRow> {
  const { rows } = await pool.query<AvailabilityRow>(
    `INSERT INTO doctor_availability (doctor_id, weekly_windows, daily_cap)
     VALUES ($1, $2, 20) RETURNING id, weekly_windows, daily_cap`,
    [doctorId, JSON.stringify(defaultWindows)]
  );
  return rows[0];
}

export async function findDateOverride(doctorId: string, date: string): Promise<{ available: boolean; windows: AvailabilityWindow[] | null } | undefined> {
  const { rows } = await pool.query<{ available: boolean; windows: AvailabilityWindow[] | null }>(
    `SELECT available, windows FROM doctor_date_overrides
     WHERE doctor_id = $1 AND override_date = $2`,
    [doctorId, date]
  );
  return rows[0];
}

export async function countTodayReviews(doctorId: string, today: string): Promise<number> {
  const { rows } = await pool.query<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt
     FROM consultations
     WHERE reviewed_by = $1
       AND reviewed_at::date = $2`,
    [doctorId, today]
  );
  return rows[0]?.cnt ?? 0;
}

export async function findDoctorIdBySub(sub: string): Promise<DoctorIdRow | undefined> {
  const { rows } = await pool.query<DoctorIdRow>(
    `SELECT id FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function findDoctorIdAndAhpraNumberBySub(sub: string): Promise<{ id: string; ahpra_number: string } | undefined> {
  const { rows } = await pool.query<{ id: string; ahpra_number: string }>(
    `SELECT id, ahpra_number FROM doctors WHERE cognito_sub = $1`,
    [sub]
  );
  return rows[0];
}

export async function listUpcomingDateOverrides(doctorId: string): Promise<DateOverrideRow[]> {
  const { rows } = await pool.query<DateOverrideRow>(
    `SELECT override_date, available, windows, note
     FROM doctor_date_overrides
     WHERE doctor_id = $1 AND override_date >= CURRENT_DATE AND override_date < CURRENT_DATE + INTERVAL '60 days'
     ORDER BY override_date`,
    [doctorId]
  );
  return rows;
}

export async function upsertAvailability(
  doctorId: string,
  weeklyWindows: AvailabilityWindow[],
  dailyCap: number
): Promise<Pick<AvailabilityRow, "weekly_windows" | "daily_cap">> {
  const { rows } = await pool.query<Pick<AvailabilityRow, "weekly_windows" | "daily_cap">>(
    `INSERT INTO doctor_availability (doctor_id, weekly_windows, daily_cap)
     VALUES ($1, $2, $3)
     ON CONFLICT (doctor_id) DO UPDATE
       SET weekly_windows = EXCLUDED.weekly_windows,
           daily_cap = EXCLUDED.daily_cap,
           updated_at = NOW()
     RETURNING weekly_windows, daily_cap`,
    [doctorId, JSON.stringify(weeklyWindows), dailyCap]
  );
  return rows[0];
}

export async function insertAvailabilityUpdatedAuditLog(doctorId: string, dailyCap: number): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('doctor.availability_updated', $1, 'doctor', $2)`,
    [doctorId, JSON.stringify({ doctor_id: doctorId, daily_cap: dailyCap })]
  );
}

export async function upsertDateOverride(
  doctorId: string,
  date: string,
  available: boolean,
  windows: AvailabilityWindow[] | null,
  note: string | null
): Promise<DateOverrideRow> {
  const { rows } = await pool.query<DateOverrideRow>(
    `INSERT INTO doctor_date_overrides (doctor_id, override_date, available, windows, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (doctor_id, override_date) DO UPDATE
       SET available = EXCLUDED.available,
           windows = EXCLUDED.windows,
           note = EXCLUDED.note
     RETURNING id, override_date, available, windows, note`,
    [doctorId, date, available, windows ? JSON.stringify(windows) : null, note]
  );
  return rows[0];
}

export async function deleteDateOverride(doctorId: string, date: string): Promise<void> {
  await pool.query(
    `DELETE FROM doctor_date_overrides WHERE doctor_id = $1 AND override_date = $2`,
    [doctorId, date]
  );
}

export async function countMonthlyReviews(doctorId: string): Promise<number> {
  const { rows } = await pool.query<{ reviewed_this_month: number }>(
    `SELECT COUNT(*)::int AS reviewed_this_month
     FROM consultations
     WHERE reviewed_by = $1
       AND reviewed_at >= date_trunc('month', NOW())
       AND reviewed_at < date_trunc('month', NOW()) + INTERVAL '1 month'`,
    [doctorId]
  );
  return rows[0]?.reviewed_this_month ?? 0;
}

export async function insertCapacityAlertAuditLog(
  doctorId: string,
  utilisationPct: number,
  reviewedThisMonth: number
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('doctor.capacity_alert', $1, 'doctor', $2)
     ON CONFLICT DO NOTHING`,
    [doctorId, JSON.stringify({ utilisation_pct: utilisationPct, reviewed_this_month: reviewedThisMonth })]
  ).catch(() => {});
}

export async function insertDailyCapReachedAuditLog(
  doctorId: string,
  dailyCap: number,
  todayCount: number
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_type, actor_id, actor_role, metadata)
     VALUES ('doctor.daily_cap_reached', $1, 'doctor', $2)`,
    [doctorId, JSON.stringify({ daily_cap: dailyCap, today_count: todayCount })]
  ).catch(() => {});
}

export async function findAllActiveDoctorsWithAvailability(): Promise<DoctorWithAvailabilityRow[]> {
  const { rows } = await pool.query<DoctorWithAvailabilityRow>(
    `SELECT d.id, da.weekly_windows, da.daily_cap
     FROM doctors d
     JOIN doctor_availability da ON da.doctor_id = d.id
     WHERE d.is_active = TRUE`
  );
  return rows;
}

export async function countQueuedConsultations(): Promise<number> {
  const { rows } = await pool.query<QueueCountRow>(
    `SELECT COUNT(*)::int AS cnt FROM consultations WHERE status = 'queued_for_review'`
  );
  return rows[0]?.cnt ?? 0;
}
