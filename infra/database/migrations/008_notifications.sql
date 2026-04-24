-- PRD-014: Patient Notifications
-- Tracks email notifications dispatched via SendGrid and their delivery status.

CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     UUID        REFERENCES consultations(id),
  patient_id          UUID        NOT NULL REFERENCES patients(id),

  notification_type   TEXT        NOT NULL CHECK (
                        notification_type IN (
                          'response_ready',
                          'rejected',
                          'consultation_confirmation',
                          'emergency_escalation'
                        )
                      ),

  -- SendGrid assigns a message ID in the X-Message-Id response header
  sendgrid_message_id TEXT,

  status              TEXT        NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),

  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,   -- set when patient opens inbox item

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT INSERT, SELECT, UPDATE ON notifications TO app_role;

CREATE INDEX IF NOT EXISTS idx_notifications_consultation ON notifications(consultation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_patient      ON notifications(patient_id);
-- Used by webhook handler to locate notification from SendGrid event
CREATE INDEX IF NOT EXISTS idx_notifications_sendgrid_id  ON notifications(sendgrid_message_id)
  WHERE sendgrid_message_id IS NOT NULL;
