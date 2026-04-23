-- PRD-010: Photo Upload & Quality Guidance
-- Stores metadata for photos uploaded during a consultation.
-- Photo binaries live in S3; only the S3 key is stored here.

CREATE TABLE IF NOT EXISTS consultation_photos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID        NOT NULL REFERENCES consultations (id) ON DELETE CASCADE,

  -- S3 object key: {consultation_id}/{uuid}.jpg — no PII in path
  s3_key            TEXT        NOT NULL,

  mime_type         TEXT        NOT NULL DEFAULT 'image/jpeg',
  size_bytes        INTEGER     NOT NULL,
  width_px          INTEGER     NOT NULL,
  height_px         INTEGER     NOT NULL,

  -- Client-side quality assessment result
  quality_passed    BOOLEAN     NOT NULL,
  -- JSON array of failed checks: e.g. ["blurry", "too_dark"]
  quality_issues    JSONB       NOT NULL DEFAULT '[]',
  -- True if patient confirmed upload despite quality warning
  quality_overridden BOOLEAN    NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT ON consultation_photos TO app_role;

CREATE INDEX IF NOT EXISTS idx_consultation_photos_consultation_id
  ON consultation_photos (consultation_id);
