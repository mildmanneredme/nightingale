# PRD-013 — Doctor Review Dashboard

> **Status:** Not Started
> **Phase:** Sprint 5 (Week 10–12)
> **Type:** Technical — Doctor Web App
> **Owner:** CTO + Medical Director

---

## Overview

The doctor review dashboard is the clinician-facing interface. It presents the GP with a queue of pending consultations, each containing everything they need to make a clinical decision: the patient's transcript, AI-generated SOAP note, differential diagnoses, red flags, uploaded photos, and draft patient response. The doctor takes one of three actions: approve (send as-is), amend (edit then send), or reject (cannot assess remotely — refund triggered).

Every doctor action is logged to the immutable audit trail with the doctor's AHPRA registration number attached. This is non-negotiable for medicolegal compliance.

---

## Background

The target doctor review time is **< 5 minutes per consultation**. Dashboard design must prioritise information density and decision speed. The GP has already paid for their clinical training — the UI should present information clearly, not hand-hold.

At MVP, there is one doctor (the Medical Director). The dashboard must support multiple doctors with assignment and queue management from Day 1 — adding a second doctor should require no code changes.

---

## Functional Requirements

### Consultation Queue

| # | Requirement |
|---|-------------|
| F-001 | Doctor sees a list of pending consultations in their queue, sorted by submission time (oldest first) |
| F-002 | Queue item shows: patient age + sex (no name for privacy until consultation opened), chief complaint, submission time, consultation mode (voice/text), photo count, any flags (low confidence, incomplete interview, poor photo quality) |
| F-003 | Flagged consultations displayed prominently with a visual indicator |
| F-004 | Doctor can filter queue by: flag status, consultation mode, date range |
| F-005 | Queue updates in real-time (polling or WebSocket); new consultations appear without page refresh |
| F-006 | Doctor sees only consultations in their assigned queue, never another doctor's queue |

### Consultation Detail View

| # | Requirement |
|---|-------------|
| F-007 | Doctor opens a consultation to see full detail: patient name + age + sex + medical history (allergies, medications, conditions) |
| F-008 | Chief complaint displayed prominently at top of detail view |
| F-009 | Full transcript displayed in conversation format: AI utterances and patient utterances clearly differentiated |
| F-010 | AI-generated SOAP note displayed in full (Subjective, Objective, Assessment, Plan sections) |
| F-011 | Differential diagnosis list displayed: ranked by likelihood, each with rationale and confidence level |
| F-012 | Red flags section: any symptoms flagged by AI during interview displayed in a distinct warning block |
| F-013 | Photos displayed inline with the SOAP note's "Objective" section; click to enlarge |
| F-014 | Draft patient response displayed in full, with word count |
| F-015 | "Opening" a consultation is logged to audit trail (doctor ID, AHPRA, consultation ID, timestamp) |

### Doctor Actions

#### Approve

| # | Requirement |
|---|-------------|
| F-016 | "Approve" button sends the AI draft response to the patient as-is |
| F-017 | Confirmation dialog: "Send this response to the patient? This action cannot be undone." |
| F-018 | Approval logs: doctor ID, AHPRA number, consultation ID, timestamp, indication that no amendment was made |
| F-019 | Patient notification is triggered immediately on approval (PRD-014) |

#### Amend

| # | Requirement |
|---|-------------|
| F-020 | "Amend" enters an edit mode on the draft patient response |
| F-021 | Doctor edits in a rich-text editor (bold, bullet points, paragraph breaks only; no image insertion) |
| F-022 | AI draft and edited version are both stored; diff is logged to audit trail |
| F-023 | "Send Amended Response" button confirms and triggers patient notification with the edited version |
| F-024 | Amendment logs: doctor ID, AHPRA number, consultation ID, timestamp, amendment diff hash |

#### Reject

| # | Requirement |
|---|-------------|
| F-025 | "Reject — Cannot Assess Remotely" option opens a rejection dialog |
| F-026 | Doctor must select a rejection reason code: "Physical exam required", "Insufficient information", "Outside remote scope", "Other (write-in)" |
| F-027 | Doctor may write a custom message to the patient explaining the rejection and recommending next steps (e.g., in-person GP visit) |
| F-028 | If no custom message written, a default rejection message is sent |
| F-029 | Rejection triggers: automatic full refund (PRD-007), patient notification with rejection reason (PRD-014) |
| F-030 | Rejection logged: doctor ID, AHPRA number, consultation ID, timestamp, reason code, custom message (if any) |

### Consultation Assignment

| # | Requirement |
|---|-------------|
| F-031 | At MVP, consultations are assigned to the Medical Director's queue by default |
| F-032 | Admin can manually reassign a consultation from one doctor's queue to another |
| F-033 | Assignment change logged to audit trail |

---

## Non-Functional Requirements

- **Speed:** Dashboard loads pending queue in < 2 seconds; consultation detail view loads in < 3 seconds including photo thumbnails
- **Mobile-responsive:** Dashboard must be usable on iPad-sized browser (768px); full-desktop experience is the primary target
- **Session:** Doctor session expiry is 60 minutes of inactivity (longer than patient sessions)

---

## UI Layout Reference

```
[ NIGHTINGALE DOCTOR PORTAL ]          [ Dr. Sarah Chen — Log Out ]

PENDING CONSULTATIONS (4)              [ Filter ▼ ]

┌─────────────────────────────────────────────────────────┐
│  ⚠ LOW CONFIDENCE   M/42   Chest tightness   2h ago    │  ← flagged
│  Voice | 2 photos                          [ Open ]     │
├─────────────────────────────────────────────────────────┤
│  F/28   Skin rash, itching   1h 45m ago                 │
│  Voice | 3 photos                          [ Open ]     │
├─────────────────────────────────────────────────────────┤
│  M/67   Frequent urination, dysuria   1h 20m ago        │
│  Text Chat | No photos                     [ Open ]     │
└─────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Doctor logs in with MFA and sees only their assigned consultation queue
- [ ] Queue shows flags (low confidence, incomplete interview) prominently
- [ ] Opening a consultation logs the event to audit trail with AHPRA number
- [ ] Full SOAP note, differential list, photos, and draft response visible in consultation detail
- [ ] Approve action sends patient notification; approval logged with AHPRA
- [ ] Amend action: doctor edits draft, sends amended response; both versions stored; diff logged
- [ ] Reject action: refund triggered, patient notified, reason code and AHPRA logged
- [ ] Second doctor account added by admin; that doctor only sees their own queue
- [ ] Dashboard usable on iPad-width browser (768px)

---

## Dependencies

- PRD-004: Doctor authentication and role-based access
- PRD-005: Audit log (all doctor actions require AHPRA-tagged audit entries)
- PRD-012: Clinical AI Engine outputs must be complete before consultation appears in queue
- PRD-014: Patient notification triggered by approve/amend/reject actions

---

## Out of Scope

- Doctor mobile app (Phase 2)
- In-app messaging between doctor and patient
- Doctor performance analytics dashboard (Phase 2)
- Multi-clinic queue management (Phase 2 white-label)
