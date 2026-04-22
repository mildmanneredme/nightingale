# PRD-006 — Patient Registration & Profile

> **Status:** Not Started
> **Phase:** Sprint 1 (Week 3–4)
> **Type:** Technical — Patient Web App
> **Owner:** CTO

---

## Overview

Patients need to create an account and build a medical profile before they can book a consultation. The profile provides clinical context that the AI voice agent and Clinical AI Engine use throughout the consultation. Profile data is never mandatory to start — anonymous mode must be supported — but completeness directly improves consultation quality.

---

## Background

Patient onboarding serves two goals:
1. **Legal:** Capture consent (Privacy Policy, Collection Notice, paediatric consent)
2. **Clinical:** Build a medical context record (allergies, medications, conditions) that the AI uses to personalise the interview and flag contraindications

The Medical Director must review the minimum viable profile fields before Sprint 1 starts.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Self-registers; can only access and modify their own profile and consultation history |
| Doctor | No direct access to patient profiles; receives profile context as a snapshot embedded in their consultation tickets only |
| Admin | No access to patient clinical profiles; operational data only |

---

## Functional Requirements

### Registration Flow

| # | Requirement |
|---|-------------|
| F-001 | Patient registers with: email address + password |
| F-002 | Email verification sent on registration; account is inactive until verified |
| F-003 | Privacy Policy and Collection Notice displayed and accepted before account creation |
| F-004 | Acceptance timestamp stored in database (Privacy Act compliance) |
| F-005 | Anonymous mode: patient can register with email only, skipping all profile fields |
| F-006 | Anonymous mode is explicitly communicated: "You can add health details later to improve consultation quality" |
| F-007 | Date of birth is the only additional required field for non-anonymous registration (age-based scope restrictions) |

### Medical Profile

| # | Requirement |
|---|-------------|
| F-008 | Patient can set and update: full name, date of birth, sex, Medicare number (optional), phone number (optional) |
| F-009 | Patient can add/edit/remove: known allergies (free text + severity: mild/moderate/severe) |
| F-010 | Patient can add/edit/remove: current medications (name + dose + frequency) |
| F-011 | Patient can add/edit/remove: existing conditions/diagnoses (free text) |
| F-012 | Patient can add emergency contact: name + phone + relationship |
| F-013 | Profile completeness indicator shown in patient dashboard (not required; informational only) |
| F-014 | Profile changes are versioned; clinical context snapshot taken at consultation start (historical profile preserved) |

### Paediatric Registration

| # | Requirement |
|---|-------------|
| F-015 | When date of birth indicates patient is under 18, a parent/guardian consent step is required |
| F-016 | Parent/guardian must provide: full name, email, relationship to patient |
| F-017 | Parent/guardian confirms they have authority to consent to medical consultations for the child |
| F-018 | Paediatric flag stored in patient record; propagated to all consultations for that patient |
| F-019 | Parent/guardian email receives copies of all consultation notifications for the patient |

### Profile Management

| # | Requirement |
|---|-------------|
| F-020 | Patient can view consultation history: list of past consultations with date, status, and doctor name |
| F-021 | Patient can download their full medical record (GDPR/APP-style data export) |
| F-022 | Patient can request account deletion; deletion is logged in audit trail; health records retained 7 years per policy (record deactivated, not deleted) |

---

## Non-Functional Requirements

- **Data residency:** All profile data stored in AWS RDS (ap-southeast-2)
- **Encryption:** Profile data encrypted at rest (KMS-managed keys)
- **Mobile-responsive:** Registration and profile management flows fully usable on mobile browsers

---

## Patient Profile UI — Key Screens

1. **Register** — Email + password + Privacy Policy accept
2. **Verify Email** — Instruction screen; resend option
3. **Build Your Profile** (optional, skippable) — DOB, name, Medicare, allergies, medications, conditions
4. **Dashboard** — Consultation history, "Start New Consultation" CTA, profile completeness nudge
5. **Profile Edit** — Full profile management

---

## Compliance Notes

**Privacy Act / APPs:** Health information collected at registration (DOB, allergies, medications, conditions) is sensitive information under the Privacy Act. The Collection Notice must be displayed and accepted before any data is collected; the acceptance timestamp is a legal record.

**AHPRA:** No patient-facing copy in this PRD refers to diagnosis or clinical outcomes. Profile completion is framed as improving "consultation quality", not "accuracy of diagnosis".

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `patient.registered` | Account created and email verified |
| `privacy_policy_accepted` | Collection Notice accepted; stores policy version and timestamp |
| `paediatric_consent_accepted` | Parent/guardian completes consent step for under-18 patient |
| `account.deletion_requested` | Patient requests deletion; record deactivated, not deleted (7-year retention) |

**Data residency:** All profile data stored in RDS ap-southeast-2. No patient data leaves Australia for this feature.

---

## Acceptance Criteria

- [ ] Patient can register with email only (anonymous mode); account activated after email verification
- [ ] Privacy Policy acceptance recorded with timestamp in database
- [ ] Patient under 18 (by DOB) is required to complete paediatric consent step; paediatric flag set in record
- [ ] Patient can add, edit, and remove allergy entries
- [ ] Patient can add, edit, and remove medication entries
- [ ] Profile snapshot is taken at consultation start; subsequent profile changes do not alter the snapshot
- [ ] Patient can download their data (JSON or PDF) from the profile page
- [ ] Account deletion request is logged; record is deactivated, not deleted from database
- [ ] All screens usable on a 375px-wide mobile browser

---

## Dependencies

- PRD-004: Auth required; registration flow follows auth system
- PRD-005: Privacy Policy acceptance timestamp logged to audit

---

## Out of Scope

- Identity verification / ID document upload (anonymous mode is intentional; Phase 2)
- Integration with Medicare / MyGov for auto-population of profile
- My Health Record integration (Phase 2)
- Repeat prescription management (Phase 2)
