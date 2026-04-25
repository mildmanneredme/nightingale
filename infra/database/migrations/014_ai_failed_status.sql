-- C-06: Add ai_failed consultation status for async error recovery (F-029, F-033)
-- When the clinical AI engine exhausts all retries, the consultation transitions to
-- ai_failed so the admin queue can surface it and manual triage can occur.
-- C-10: Preserves follow-up statuses added in 011_followup.sql (resolved, unchanged, followup_concern).

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check
  CHECK (status IN (
    'pending',
    'active',
    'transcript_ready',
    'queued_for_review',
    'emergency_escalated',
    'cannot_assess',
    'approved',
    'amended',
    'rejected',
    'ai_failed',
    'resolved',
    'unchanged',
    'followup_concern'
  ));
