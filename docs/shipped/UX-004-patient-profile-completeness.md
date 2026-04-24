# UX-004 — Patient Profile Completeness: Guardian & Contact Management

> **Status:** Not Started
> **Phase:** UX Fixes — Sprint 7
> **Type:** UX — Patient Experience / Clinical Governance
> **Priority:** P2 — Required before paediatric consultations are permitted
> **Owner:** CTO + Medical Director
> **Covers audit findings:** UX-006 (Paediatric guardian fields missing from profile page)

---

## Overview

The patient profile edit page does not expose the paediatric guardian fields that are collected at registration and stored in the database. A guardian managing a child's account has no way to update their contact details after registration. This is both a UX gap and a clinical governance issue: if a doctor needs to contact the responsible adult for a child's consultation, the contact information may be stale with no correction mechanism available to the patient.

---

## Background

PRD-006 (Patient Registration) implemented guardian fields on the patients table: `is_for_minor`, `guardian_name`, `guardian_relationship`, and `guardian_phone`. These are collected during registration for paediatric patients but are not surfaced on the profile page (`web/src/app/(patient)/profile/page.tsx`). Similarly, the API's profile update endpoint (`PATCH /api/v1/patients/me`) accepts these fields as parameters (they are whitelisted), but the frontend never sends them after initial registration.

Paediatric consultations represent a significant use case — parents managing their children's health remotely. A guardian who changes phone number, or a family where custody arrangements change who the primary guardian is, cannot update their information without contacting support.

---

## Functional Requirements

### Profile Page Guardian Section

| # | Requirement |
|---|-------------|
| F-001 | The profile page displays the guardian section when `patient.isForMinor === true` |
| F-002 | The guardian section is hidden entirely for adult patients (`isForMinor === false`) |
| F-003 | Guardian fields displayed and editable: full name, relationship to patient, phone number |
| F-004 | Saving updated guardian details calls `PATCH /api/v1/patients/me` with the updated fields |
| F-005 | Guardian phone number is validated for Australian format before submission |
| F-006 | A successful save shows a confirmation message: "Guardian details updated" |

### Profile Page General Improvements

| # | Requirement |
|---|-------------|
| F-007 | Profile page displays all fields currently stored: full name, date of birth, biological sex, phone, address, Medicare number (read-only, display only) |
| F-008 | Fields that cannot be changed after registration (e.g. date of birth, biological sex once a consultation has been completed) are displayed as read-only with a note explaining why |
| F-009 | Email address is displayed as read-only with a note: "To change your email, contact support" (email changes require Cognito account update, not a simple profile patch) |
| F-010 | The `is_for_minor` flag is displayed (read-only) so the guardian can confirm the account is correctly classified as a minor |

### API

| # | Requirement |
|---|-------------|
| F-011 | `PATCH /api/v1/patients/me` already accepts guardian fields — no API changes required unless validation is missing |
| F-012 | If guardian phone validation is not already enforced at the API, add AU phone format validation consistent with the registration endpoint |

---

## Design Notes

The guardian section should appear as a clearly labelled card ("Guardian / Parent Details") below the patient's personal information. It should only render for minor accounts. On first load, pre-populate with existing database values. Changes are saved with a single "Save Changes" button that covers the entire profile form, consistent with the existing pattern.

**Open decision:**

| Question | Owner | Required By |
|----------|-------|-------------|
| Can `is_for_minor` be changed after registration, or is it permanent? If a child turns 18 and wants to convert their account to an adult account, what is the process? | CTO + Medical Director | Before sprint start |

---

## Acceptance Criteria

- [ ] Profile page for a minor account shows guardian name, relationship, and phone as editable fields
- [ ] Profile page for an adult account does not show the guardian section
- [ ] Updating guardian phone number saves correctly and shows a confirmation message
- [ ] Profile page for any account shows all stored fields (name, DOB, sex, phone, address)
- [ ] Email field is displayed as read-only with an explanation
- [ ] TypeScript check passes

---

## Dependencies

- PRD-006: Patient Registration (database schema, API endpoint)
- PRD-020: Patient Web Frontend (design system)

---

## Out of Scope

- Changing `is_for_minor` status post-registration (requires a process decision from the Medical Director)
- Adding a secondary guardian (Phase 2)
- Parent/child account linking (Phase 2)
- Email change flow (requires Cognito account management — separate from profile)
