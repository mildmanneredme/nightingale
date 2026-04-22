# PRD-015 — Post-Consultation Follow-Up

> **Status:** Not Started
> **Phase:** Sprint 6 (Week 12–14)
> **Type:** Technical — Automated Workflows
> **Owner:** CTO

---

## Overview

24–48 hours after a patient receives their doctor's response, an automated follow-up email is sent asking how they're feeling. If the patient's response indicates their condition has worsened or is concerning, the consultation is re-opened for doctor review. This is both a patient safety mechanism and a data collection tool for tracking clinical outcomes.

---

## Background

The follow-up serves three purposes:
1. **Safety net:** Catches deteriorating patients who might not otherwise re-present
2. **Outcomes data:** Builds the dataset needed to measure clinical effectiveness over time
3. **Patient experience:** Demonstrates that Nightingale cares about outcomes, not just transaction completion

The follow-up is deliberately simple at MVP — three response options, not a full re-consultation. The goal is to detect "worsening" patients, not to conduct a second interview.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Receives follow-up email; clicks response link; no login required to submit a response (tracked by unique URL) |
| Doctor | Notified when a re-opened follow-up consultation appears in their queue; reviews it in the existing dashboard (PRD-013) |
| System | Schedules and sends follow-up emails; handles response URL tracking and consultation re-opening |

---

## Functional Requirements

### Scheduling

| # | Requirement |
|---|-------------|
| F-001 | Follow-up email scheduled 36 hours after response delivery email is sent (midpoint of 24–48 hour window) |
| F-002 | Follow-up is only sent for consultations with status "approved" or "amended" (not rejected, not emergency escalated) |
| F-003 | If response delivery email bounced (undeliverable), follow-up is not scheduled |
| F-004 | Follow-up timestamp stored in consultation record |

### Follow-Up Email

| # | Requirement |
|---|-------------|
| F-005 | Email subject: "Checking in — how are you feeling?" |
| F-006 | Email body briefly references the consultation (e.g., "Following up on your consultation about [chief complaint] on [date]") |
| F-007 | Email presents three response options as clickable buttons/links: |
|       | Option A: "Feeling better" |
|       | Option B: "About the same" |
|       | Option C: "Feeling worse or concerned" |
| F-008 | Each response option is a unique tracking URL; patient clicks to record their response |
| F-009 | After clicking, patient sees a simple confirmation page matching their response |
| F-010 | If patient does not respond within 72 hours, follow-up is marked "no response" (no action taken) |

### Response Handling

| # | Requirement |
|---|-------------|
| F-011 | "Feeling better" response: consultation status updated to "resolved"; no further action |
| F-012 | "About the same" response: consultation status updated to "unchanged"; no further action at MVP |
| F-013 | "Feeling worse or concerned" response: consultation is re-opened and placed back in doctor queue with "Follow-up concern" flag |
| F-014 | Re-opened consultation shows the doctor: original consultation detail + the follow-up response + time elapsed since original response |
| F-015 | Doctor receives notification that a follow-up concern has been flagged (email or in-app; same notification infrastructure as PRD-014) |
| F-016 | Patient is immediately sent an acknowledgement: "We've flagged your response to your doctor. They'll review shortly." |
| F-017 | Patient is not charged for a follow-up review triggered by their own concern response |

### Audit

| # | Requirement |
|---|-------------|
| F-018 | Follow-up email sent event logged to audit trail |
| F-019 | Patient response (A, B, or C) logged to audit trail with timestamp |
| F-020 | Re-opened consultation creates a new audit trail entry linked to the original consultation ID |

---

## Non-Functional Requirements

- **Timing precision:** Follow-up emails must send within ±15 minutes of scheduled time
- **Idempotency:** Follow-up email must not be sent twice for the same consultation (deduplication by consultation ID)
- **No follow-up for rejections:** Rejected consultations must be excluded from follow-up scheduling (no reminder of a bad experience)

---

## Compliance Notes

**Idempotency:** Follow-up email must not be sent twice for the same consultation. Deduplication is enforced by consultation ID at scheduling time and again at send time. Retry infrastructure must not produce a second email.

**No charge for follow-up review:** Re-opened consultations triggered by a patient's "Feeling worse" response must not generate a new Stripe charge. The consultation state machine must prevent re-billing on follow-up re-opens.

**Tracking URLs:** Response links are unique per consultation. Clicking records the response server-side. No cookies or client-side tracking required — the URL token is sufficient.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `follow_up.scheduled` | Follow-up email scheduled 36 hours after response delivery |
| `follow_up.sent` | Follow-up email dispatched |
| `follow_up.response_received` | Patient clicks a response option; includes response_option (better/same/worse), consultation_id |
| `consultation.reopened_for_followup` | "Feeling worse" response received; consultation placed back in doctor queue with follow-up flag |

---

## Acceptance Criteria

- [ ] Follow-up email sent 36 hours after response delivery for an approved consultation (verified in test environment)
- [ ] "Feeling better" response marks consultation as resolved; no further action
- [ ] "Feeling worse" response re-opens consultation in doctor queue with "Follow-up concern" flag
- [ ] Patient receives acknowledgement email within 60 seconds of clicking "Feeling worse"
- [ ] Doctor sees re-opened consultation with original transcript and follow-up response context
- [ ] Patient not charged for follow-up re-review
- [ ] Follow-up not sent for rejected or emergency-escalated consultations
- [ ] Duplicate follow-up email not sent if system retries (idempotency verified)

---

## Dependencies

- PRD-005: Audit log captures follow-up events
- PRD-013: Doctor dashboard must display re-opened consultations with follow-up context
- PRD-014: Email infrastructure used for follow-up delivery

---

## Out of Scope

- Full re-consultation for "About the same" patients (Phase 2 — could trigger a discounted repeat consult)
- SMS follow-up (Phase 2)
- Patient-initiated follow-up questions after receiving response (Phase 2)
- Multi-step follow-up sequences (e.g., follow-up again if no response — Phase 2)
