# PRD-027 — SMS Notifications

> **Status:** Not started
> **Phase:** Phase 2 — pre-scaling (before growing beyond beta cohort)
> **Type:** Technical — Notifications
> **Priority:** P2 — high engagement impact but not a beta blocker; email notifications are functional at launch
> **Owner:** CTO
> **Depends on:** PRD-014 (Patient Notifications — email service and notification DB already shipped)

---

## Overview

Patient notifications are currently email-only (PRD-014). SMS notifications are deferred in that PRD and have no implementation. For a telehealth service where "your doctor response is ready" is the primary patient-facing moment, email-only is a meaningful engagement gap — SMS open rates in Australia are ~98% vs ~20% for email, and response times matter when patients are waiting on a clinical result.

This PRD adds Twilio SMS delivery as a parallel channel alongside email for time-sensitive notification types, using phone numbers already captured in the patient profile.

---

## Background

### Why SMS matters for telehealth

Medical results carry urgency that email's open-rate profile doesn't serve well. A patient who consults in the morning and checks their email that evening has had a sub-standard experience — they were waiting without knowing their result was ready. SMS solves this. The comparison:

| Channel | Typical AU open rate | Typical time-to-read |
|---------|---------------------|---------------------|
| Email | ~20% same-session | Hours to days |
| SMS | ~98% | < 3 minutes |

### Patient phone numbers

Patient mobile numbers are collected at registration (PRD-006 — `mobile` field, E.164 AU format `+61xxxxxxxxx`). They are available on the patient profile and can be used directly for SMS delivery.

### Twilio

Twilio is the chosen SMS provider (already in NIGHTINGALE.md and `architecture-framework.md`). Twilio processes patient phone numbers and message content on servers that may be outside Australia — a DPA with Twilio must be executed before SMS is enabled (PREREQ-001 dependency).

For AU-originated SMS, Twilio supports an Australian sender ID or a dedicated long-code number (`+61` number). A dedicated `+61` number is preferred for deliverability and reply capability.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Receives SMS at their registered mobile number; can opt out of SMS (email remains mandatory for clinical results) |
| Doctor | No direct interaction with SMS layer |
| System | Twilio API sends SMS; delivery status tracked via Twilio webhook |
| Admin | Can view SMS delivery status in audit log; can see opt-out records |

---

## Notification Types

Not all notifications warrant SMS — only time-sensitive ones where fast delivery adds genuine value. Email remains the full-content channel; SMS provides a prompt.

| Notification | SMS? | SMS content |
|-------------|------|-------------|
| Response ready (approved/amended) | **Yes** | "Your Nightingale consultation response from Dr [Name] is ready. Open the app to view your assessment." |
| Rejection | **Yes** | "Your Nightingale consultation has been reviewed. Dr [Name] has recommended in-person care. Open the app for details." |
| Follow-up check-in | **Yes** | "Hi — how are you feeling after your recent Nightingale consultation? Tap to let us know: [link]" |
| Registration confirmation | No | Email sufficient |
| Consultation confirmation | No | Email sufficient |
| Emergency escalation | No | In-app banner handles this during the session; email follows |

---

## Functional Requirements

### SMS Delivery

| # | Requirement |
|---|-------------|
| F-001 | SMS sent via Twilio Messaging API for all opt-in patients with a verified mobile number |
| F-002 | SMS sent in parallel with existing email (not instead of); no dependency between the two delivery paths |
| F-003 | If patient has no mobile number on record, SMS is skipped silently; email is unaffected |
| F-004 | Twilio delivery status (delivered, failed, undelivered) tracked via Twilio webhook and stored in the `notifications` table alongside the email record |
| F-005 | SMS delivery failure does not affect email delivery or the consultation lifecycle |
| F-006 | Twilio webhook endpoint verifies request signature (`X-Twilio-Signature` header) before processing any status update |

### Patient Opt-Out

| # | Requirement |
|---|-------------|
| F-007 | Patients can opt out of SMS on their profile page; email notifications remain mandatory (clinical results must be delivered) |
| F-008 | STOP keyword reply to any Twilio number is handled automatically by Twilio; Nightingale must poll or webhook-handle Twilio opt-out events to mark the patient's record as SMS opted-out |
| F-009 | Opted-out patients are never sent SMS; their opt-out status is visible in the patient profile in the admin portal |
| F-010 | Opt-out is stored in the `patients` table as `sms_opted_out BOOLEAN DEFAULT FALSE` |

### SMS Content Constraints

| # | Requirement |
|---|-------------|
| F-011 | SMS messages must not include clinical content, medication names, diagnoses, or any health information — they are prompts to open the app only |
| F-012 | SMS must not disclose that AI was involved in the consultation |
| F-013 | SMS must not include unsubscribe instructions beyond the standard Twilio STOP footer (added automatically by Twilio on AU long-code numbers) |
| F-014 | All SMS content reviewed and approved by AHPRA advertising compliance reviewer before enabling in production |

---

## Non-Functional Requirements

- **Timing:** SMS dispatched within 60 seconds of the trigger event (same target as email)
- **PII in transit:** Twilio processes patient mobile numbers and message content — DPA with Twilio required before SMS is enabled (PREREQ-001 dependency)
- **Cost:** Twilio AU SMS pricing is approximately $0.08–0.10 AUD per message. At 3 SMS events per consultation, cost is ~$0.25 per consultation — within the $2 AI/infra budget when combined with existing email costs

---

## Compliance Notes

**Privacy Act / APP 8:** Twilio processes patient mobile numbers and message text on servers outside Australia. Twilio DPA must be signed before any SMS containing patient-identifiable information is sent. SMS content in this PRD is intentionally non-clinical to minimise sensitivity, but the mobile number itself is personal information.

**Spam Act 2003 (Cth):** Transactional SMS (clinical result notifications) are exempt from consent requirements as they relate to an existing commercial relationship. Opt-out must still be honoured.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `notification.sms_sent` | SMS dispatched via Twilio; includes twilio_sid, notification_type, patient_id |
| `notification.sms_delivered` | Twilio webhook confirms delivery |
| `notification.sms_failed` | Twilio webhook reports failure |
| `notification.sms_opted_out` | STOP reply or patient profile opt-out recorded |

---

## Database Changes

```sql
-- Add SMS opt-out flag to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS sms_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Extend notifications table to track SMS alongside email
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sms_twilio_sid TEXT,
  ADD COLUMN IF NOT EXISTS sms_status TEXT,        -- sent, delivered, failed, opted_out
  ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_delivered_at TIMESTAMPTZ;
```

---

## Acceptance Criteria

- [ ] Doctor approves consultation → patient receives SMS within 60 seconds (if mobile on file, not opted out)
- [ ] Doctor rejects → patient receives SMS within 60 seconds
- [ ] Patient with no mobile number: SMS skipped; email delivery unaffected
- [ ] Patient opts out via profile: no further SMS sent; opt-out recorded in DB
- [ ] STOP reply: Twilio opt-out webhook received and recorded; patient marked opted out
- [ ] SMS content contains no clinical information or AI disclosure
- [ ] Twilio webhook endpoint rejects requests without valid `X-Twilio-Signature`
- [ ] Twilio DPA signed before this PRD is enabled in production (PREREQ-001 gate)
- [ ] AHPRA compliance reviewer has approved all SMS message copy

---

## Dependencies

- PRD-006: Patient profile (mobile number field — already captured)
- PRD-014: Notification service (email delivery — SMS extends this service, not replaces it)
- PRD-013: Doctor approval/rejection triggers (already fire email; same trigger fires SMS)
- PREREQ-001: Twilio DPA signed before production enablement

---

## Out of Scope

- SMS-based consultation booking or response (patients cannot reply to clinical content via SMS)
- Two-way SMS chat
- WhatsApp or other messaging channels
- Push notifications (no native app at MVP)
- International SMS (AU numbers only at Phase 2)
