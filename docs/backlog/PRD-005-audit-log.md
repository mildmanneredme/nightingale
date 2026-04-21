# PRD-005 — Audit Log & Compliance Infrastructure

> **Status:** Not Started
> **Phase:** Sprint 0 (Week 1–2)
> **Type:** Technical — Compliance
> **Owner:** CTO

---

## Overview

An immutable, tamper-evident audit log is a hard legal and clinical governance requirement. It must capture every significant system action — from AI outputs to doctor approvals to patient communications — with timestamps and actor identifiers. This must be operational before the first consultation is conducted.

The audit log is a medicolegal protection for the Medical Director, the company, and the patient. In the event of an adverse outcome or regulatory investigation, the audit trail must be complete, coherent, and unalterable.

---

## Background

### Why Immutable

Any system allowing deletion or modification of audit records is legally unacceptable in a healthcare context. "Immutable" means:
- Records cannot be edited after write
- Records cannot be deleted before retention period expires
- The deletion or modification of records is itself logged

Implementation: Append-only database table (no UPDATE/DELETE privileges on audit rows) + S3 object lock (WORM) as secondary archive.

### Retention Requirement

Health records in Australia must be retained for a minimum of **7 years** (or until the patient turns 25, whichever is later, for paediatric records). The audit log is part of the clinical record.

---

## What Must Be Logged

### Authentication Events
- Patient login / logout
- Doctor login / logout / MFA completion
- Failed login attempts (with IP address)
- Account creation, deactivation

### Consultation Lifecycle
- Consultation created (patient ID, timestamp, payment status)
- AI voice interview started / ended (consultation ID, duration)
- Photo uploaded (consultation ID, photo count)
- Clinical AI Engine invoked (consultation ID, model version, prompt hash)
- Clinical AI Engine response received (consultation ID, SOAP hash, differential count, confidence levels)
- Consultation submitted to doctor queue (consultation ID, assigned doctor ID)

### Doctor Actions (Every Action Must Include AHPRA Number)
- Doctor opened consultation for review (doctor ID, AHPRA, consultation ID, timestamp)
- Doctor approved consultation (doctor ID, AHPRA, consultation ID, timestamp, AI draft or edited)
- Doctor amended consultation (doctor ID, AHPRA, consultation ID, amendment diff hash)
- Doctor rejected consultation (doctor ID, AHPRA, consultation ID, reason code)
- Doctor escalated consultation (doctor ID, AHPRA, consultation ID, escalation reason)

### Patient Communications
- Email notification sent (consultation ID, recipient, timestamp, SendGrid message ID)
- Follow-up email sent (consultation ID, timestamp)
- Follow-up response received (consultation ID, response option, timestamp)
- Follow-up concerning response flagged (consultation ID, timestamp)

### System Events
- Anonymisation layer invoked (consultation ID — logs that PII was stripped, not the PII itself)
- External API called: voice agent, clinical AI, photo analysis (consultation ID, provider, duration, success/failure)
- Payment charged / refunded (consultation ID, Stripe payment intent ID)

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Audit table in PostgreSQL with append-only constraint (no UPDATE/DELETE privileges for application role) |
| F-002 | Each record contains: event_type, actor_id, actor_role, consultation_id (nullable), metadata (JSONB), created_at (UTC, microsecond precision) |
| F-003 | actor_id for AI-generated events is a system identifier, not a human user ID |
| F-004 | All doctor action records must include ahpra_number field; non-null constraint enforced at DB layer |
| F-005 | Hourly batch export of new audit records to S3 audit bucket (WORM object lock, 7-year retention) |
| F-006 | Audit records are never returned in patient-facing API responses |
| F-007 | Admin-facing audit log viewer: filter by consultation_id, actor_id, event_type, date range |
| F-008 | Alert on: gap in expected event sequence (e.g. consultation submitted to queue with no AI Engine invocation logged) |

---

## Schema (Reference)

```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  actor_id      UUID NOT NULL,
  actor_role    TEXT NOT NULL CHECK (actor_role IN ('patient', 'doctor', 'admin', 'system')),
  ahpra_number  TEXT,  -- required when actor_role = 'doctor'
  consultation_id UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No UPDATE or DELETE privileges granted to application role
-- Application role has INSERT + SELECT only
```

---

## Non-Functional Requirements

- **Integrity:** Audit records must survive application-layer bugs; direct DB access cannot mutate records
- **Retention:** 7-year minimum; paediatric records: until patient turns 25
- **Latency:** Audit write must complete within 500ms of triggering event; async acceptable for non-blocking events
- **Availability:** Audit log failure must not block consultation flow — use async queue with retry if direct write fails

---

## Acceptance Criteria

- [ ] Audit table created with append-only constraint; INSERT-only role confirmed by attempting an UPDATE (must fail)
- [ ] Doctor approval action produces audit record with AHPRA number; null AHPRA causes record write to fail
- [ ] Consultation created → consultation submitted → doctor reviewed → patient notified: all 4 events appear in audit log
- [ ] Hourly batch export runs and produces WORM-locked objects in S3 audit bucket
- [ ] Admin can query audit log by consultation ID and retrieve full event history
- [ ] Audit log write failure does not cause consultation to fail (async retry)

---

## Dependencies

- PRD-003: S3 audit bucket with WORM must be provisioned
- PRD-004: Actor IDs and roles come from the auth system

---

## Out of Scope

- Real-time audit dashboard for compliance officers (admin list view is sufficient for Phase 1)
- Tamper-evident hash chaining of audit records (consider for Phase 2 if regulatory pressure)
- SIEM integration (Phase 2)
