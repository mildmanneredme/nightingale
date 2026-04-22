# PRD-018 — Script Renewal Workflow

> **Status:** Not Started
> **Phase:** Sprint 5 (Week 10–12)
> **Type:** Technical — Clinical Workflow
> **Owner:** CTO + Medical Director

---

## Overview

The doctor analytics screen shows "Script renewals — Expiring in less than 48 hours" as a priority action type in the doctor queue. Repeat prescription renewals are a distinct, high-volume consultation type for general practice. This PRD defines how Nightingale handles them.

> **⚠ Feasibility flag:** Script renewals involve PBS-listed medications and formal prescriptions. Since eScript integration (Fred Dispense / ScriptPad) is out of scope for Phase 1, the mechanism for *issuing* a renewed prescription must be confirmed with the healthcare lawyer and Medical Director before this PRD is built. See the open decision below.

---

## Background

Patients on long-term medications (e.g., antihypertensives, antidepressants, oral contraceptives) need periodic prescription renewals from their GP. At Nightingale, a renewal request is a lightweight consultation: no AI interview needed, just the doctor confirming the existing medication is appropriate to continue.

This is a common enough use case that it appears as a distinct queue item type in the doctor portal design. Getting it wrong has clinical risk (patient without medication) and regulatory risk (prescribing without appropriate review).

**Open decision — required before sprint start:**

| Question | Owner | Required By |
|----------|-------|-------------|
| What is the legal mechanism for issuing a renewed prescription without eScript? Options: (a) doctor writes a paper script mailed to patient, (b) doctor uses their own prescribing system externally and Nightingale only records the renewal, (c) defer until eScript integration is built. | CTO + Medical Director + Lawyer | Sprint 5 start |

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Submits a renewal request; receives confirmation and prescription handling instructions |
| Doctor | Reviews renewal request in queue; approves or declines with reason |
| System | Tracks renewal expiry; generates queue alerts 48h before expected expiry based on last renewal date |

---

## Functional Requirements

### Renewal Request (Patient)

| # | Requirement |
|---|-------------|
| F-001 | Patient can submit a script renewal request from their consultation history: select a past consultation containing a medication recommendation, request renewal |
| F-002 | Renewal request includes: medication name (from past consultation), dosage (from past consultation), patient confirmation that they have not experienced adverse effects and condition has not changed |
| F-003 | Patient sees a warning: "Script renewals are only available for medications previously recommended by a Nightingale doctor. If your condition has changed, please start a new consultation." |
| F-004 | Renewal request is a separate, lower-cost consultation type (pricing TBD by Medical Director; suggested ~$20 AUD); does not trigger a full AI interview |
| F-005 | AI processing for a renewal is limited to: checking the medication against the patient's current allergy and medication list for contraindications; no SOAP generation required |

### Doctor Renewal Review

| # | Requirement |
|---|-------------|
| F-006 | Renewal requests appear in a dedicated section of the doctor queue, separate from full consultations |
| F-007 | Queue alert generated 48 hours before a renewal is expected to expire, based on typical prescription duration from the original recommendation |
| F-008 | Doctor sees: patient name, medication, dosage, last prescribed date, patient's confirmation of no adverse effects |
| F-009 | Doctor can: approve (proceed to prescription issuance per agreed legal mechanism) or decline (with reason; patient notified) |
| F-010 | Approval and decline both logged with doctor AHPRA number and timestamp |

### Expiry Tracking

| # | Requirement |
|---|-------------|
| F-011 | System tracks the expected renewal date for each medication from past consultations (based on typical prescription duration defined per medication class by Medical Director) |
| F-012 | Patient receives a proactive email 7 days before expected expiry: "Your prescription for [medication] may be due for renewal. Request a renewal on Nightingale." |
| F-013 | Proactive renewal prompts are opt-in; patient can disable per medication |

---

## Compliance Notes

**Prescribing authority:** Only a registered GP with AHPRA credentials can authorise a prescription renewal. Doctor AHPRA number must be attached to every renewal approval in the audit log.

**No auto-renewal:** The system must never automatically renew a prescription without explicit doctor approval. Auto-approval is a P1 clinical safety violation.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `renewal.requested` | Patient submits renewal request |
| `renewal.approved` | Doctor approves; includes doctor_id, ahpra_number, medication, consultation_id |
| `renewal.declined` | Doctor declines; includes reason_code |
| `renewal.expiry_alert_sent` | 48h expiry alert placed in doctor queue |
| `renewal.patient_reminder_sent` | 7-day proactive renewal email sent to patient |

---

## Acceptance Criteria

- [ ] Legal mechanism for prescription issuance confirmed with lawyer and Medical Director before sprint starts
- [ ] Patient can submit a renewal request referencing a past consultation
- [ ] Renewal request appears in a dedicated queue section in the doctor dashboard
- [ ] 48h expiry alert fires correctly based on medication duration settings
- [ ] Doctor approval logged with AHPRA number; decline triggers patient notification with reason
- [ ] Auto-renewal is technically impossible — no code path approves a renewal without a doctor action
- [ ] Patient receives proactive renewal reminder 7 days before expiry (for opted-in medications)

---

## Dependencies

- PRD-004: Doctor authentication (AHPRA number required for all actions)
- PRD-005: Audit log (all renewal actions require AHPRA-tagged entries)
- PRD-006: Patient medication history (source of renewal eligibility data)
- PRD-013: Doctor dashboard (renewal queue rendered here)
- PRD-014: Patient notifications (renewal reminders and confirmations)

---

## Out of Scope

- eScript integration / electronic prescription issuance (Phase 2 — Fred Dispense / ScriptPad)
- Automatic renewal without doctor review (permanently out of scope — clinical safety)
- New medications not previously prescribed via Nightingale (full new consultation required)
