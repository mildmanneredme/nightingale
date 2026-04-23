-- PRD-013: Doctor Review Dashboard
-- Creates the doctors table for AHPRA-registered practitioners.

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  ahpra_number TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON doctors TO app_role;
