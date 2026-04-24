-- PRD-017: Doctor Scheduling & Availability

-- Weekly recurring schedule: one record per doctor.
-- weekly_windows: [{day: 0-6, start_time: "HH:MM", end_time: "HH:MM"}]
-- Times stored in AEST (UTC+10). DST conversion handled in application layer.
CREATE TABLE IF NOT EXISTS doctor_availability (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id      UUID        NOT NULL REFERENCES doctors(id) UNIQUE,
  weekly_windows JSONB       NOT NULL DEFAULT '[]',
  daily_cap      INTEGER     NOT NULL DEFAULT 20 CHECK (daily_cap >= 1 AND daily_cap <= 100),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE ON doctor_availability TO app_role;

-- Date-specific overrides: mark a date unavailable (leave, holiday) or add extra hours.
-- available=FALSE: doctor is blocked out for this date despite weekly schedule.
-- available=TRUE: doctor has extra availability on this date (used for ad-hoc additions).
CREATE TABLE IF NOT EXISTS doctor_date_overrides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID        NOT NULL REFERENCES doctors(id),
  override_date DATE        NOT NULL,
  available     BOOLEAN     NOT NULL DEFAULT FALSE,
  windows       JSONB,      -- custom windows if available=TRUE; NULL means use weekly schedule
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(doctor_id, override_date)
);

GRANT INSERT, SELECT, UPDATE, DELETE ON doctor_date_overrides TO app_role;
CREATE INDEX IF NOT EXISTS idx_doctor_date_overrides_doctor ON doctor_date_overrides(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_date_overrides_date   ON doctor_date_overrides(doctor_id, override_date);

-- Auto-update updated_at on doctor_availability
DROP TRIGGER IF EXISTS doctor_availability_updated_at ON doctor_availability;
CREATE TRIGGER doctor_availability_updated_at
  BEFORE UPDATE ON doctor_availability
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
