# PRD-023 — Patient Onboarding & Clinical Baseline

> **Status:** Not Started
> **Phase:** Build — onboarding & clinical-safety
> **Type:** Patient Experience + Clinical Data Capture
> **Priority:** P1 — required before beta cohort; clinical safety + doctor-review quality depend on it
> **Owner:** CTO
> **Sprint:** TBD
> **Depends on:** PRD-006 (Patient Registration — initial patient table), PRD-022 (Marketing routes), BUG-007 (placeholder removal — clears the dashboard so PRD-023 can replace tiles cleanly)

---

## Overview

Today, after a patient verifies their email, they land on the dashboard with no name, no clinical history, and no prompt to provide either. The doctor reviewing the eventual consultation has the same thing the patient has given so far: an email address. The AI assistant starts cold and burns the first 3–4 turns asking basic demographic and history questions that should already be on file.

This PRD inserts a structured onboarding wizard between email verification and the dashboard, captures a meaningful clinical baseline (allergies, current medications, known conditions), surfaces real (not fabricated) profile completeness, and threads the captured data through to the doctor review queue and AI assistant context.

---

## Background

**What PRD-006 originally promised but did not ship:**
- "Full address captured" — only email + privacy version reaches the API today (`registerPatient(email, "v1.0")`).
- "Paediatric guardian fields included" — shipped, but only conditionally renders on the profile page; never collected at signup.

**What PRD-006 explicitly deferred:**
- IHI / Medicare verification (HI Service integration deferred to Phase 2 — free-text only acceptable for MVP).

**Why this matters now:**
- Clinical safety: AHPRA constraints in `clinical-knowledge/system-prompts/` reference "patient profile context" — the engine assumes profile data exists.
- Doctor review quality: `services/clinicalAiEngine.ts` produces SOAP notes and differential diagnoses; missing baseline (allergies, current meds) means the doctor must ask for it on every approval, defeating the time-saving promise of HITL review.
- AI assistant performance: voice and text intake currently spend 3–4 turns establishing identity and history. Pre-collected context lets the AI go straight to the presenting complaint.
- Trust: a brand-new account with a hardcoded "85% Complete" profile (BUG-007) erodes credibility; a real onboarding flow with honest progress builds it.

---

## Goals

1. Capture a sufficient clinical baseline at first sign-in to make the doctor review meaningful and the AI intake efficient.
2. Make the onboarding skippable but visibly incomplete — no fake green checks; missing fields are surfaced honestly to the patient and to the doctor.
3. Personalise the dashboard greeting and inbox once a name is on file.
4. Add a `clinical_context_warnings` field on the doctor queue that lists missing baseline data per consultation, so reviewing GPs can see what they don't know.

---

## Non-Goals

- **Payment collection at signup** — PRD-007 (Payments) handles billing; this PRD does not gate the wizard behind a payment.
- **HI Service / Medicare lookup** — Medicare number captured as free text only, validated by length/format only. HI Service integration is Phase 2.
- **EMR import** — out of scope (Phase 2).
- **Wearable / vitals integration** — out of scope (replaces the fake Vitals Snapshot tile from BUG-007 with **nothing**, not a new integration).
- **Re-onboarding existing patients** — existing accounts are flagged as "incomplete profile" and prompted via dashboard banner; no forced wizard.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Completes wizard at first login; can revisit any step from `/profile`; can skip non-mandatory fields |
| Doctor | Sees `clinical_context_warnings` on queue rows when reviewing a consultation with missing baseline |
| Admin | Can view patient profile completeness in admin tooling (read-only) |

---

## Functional Requirements

### Wizard Flow (post-verify, pre-dashboard)

| # | Requirement |
|---|-------------|
| F-001 | After successful email verification + `signIn`, route the user to `/onboarding/welcome` instead of `/dashboard` |
| F-002 | Welcome screen explains "We'll ask a few questions so doctors and our AI assistant have what they need" — three-step progress indicator |
| F-003 | Step 1 — **Identity**: first name (required), last name (required), date of birth (required), preferred name (optional), phone (required) |
| F-004 | Step 2 — **Address & Healthcare**: street + suburb + state + postcode (Australian states only), Medicare number (optional, free text, format-validated 10–11 digits), regular GP / clinic name (optional free text) |
| F-005 | Step 3 — **Clinical Baseline**: known allergies (free text, with explicit "None known" toggle), current regular medications (free text, with "None" toggle), known chronic conditions (free text, with "None" toggle), is this account for a child under 18 (yes/no — if yes, capture guardian name + relationship inline) |
| F-006 | Each step has "Skip for now" — submitting a skipped step still advances; profile completeness reflects what is missing |
| F-007 | "Skip for now" on a required field (Step 1 name + DOB) shows a soft warning ("Doctors need this to review your consultation safely") but does not block; the skip is recorded as `pending_required` |
| F-008 | Final step on completion → redirect to `/dashboard` with first-time `welcome=true` flag |

### Dashboard Changes

| # | Requirement |
|---|-------------|
| F-009 | Replace `Good morning` with `Good morning, {firstName}` once a first name is on file; falls back to `Good morning` if not |
| F-010 | First-login welcome banner: "Welcome to Nightingale, {firstName}. Here's what's left to set up." with a checklist of incomplete profile items linking to the relevant `/profile` section. Dismissable; reappears if any required field is still missing after 24h |
| F-011 | Profile completeness tile (replaces hardcoded "85%" from BUG-007): real percentage = filled fields / total fields, with the **specific** missing field names listed underneath ("Add your phone number", "Add allergies — even if 'none known'"). Each link deep-links to the relevant profile field |
| F-012 | If `pending_required` flags exist (skipped Step 1 fields), banner is non-dismissable until those specific fields are filled |

### Profile Page Extensions

| # | Requirement |
|---|-------------|
| F-013 | Profile page exposes all fields captured by the wizard, organised under three sections matching the wizard steps |
| F-014 | Each section header shows a sub-completeness percentage |
| F-015 | "Why we ask" tooltip on each clinical-baseline field (allergies, medications, conditions) explains the medical reason succinctly |
| F-016 | Medicare number field shows format hint and validates length on blur |

### Backend (API + DB)

| # | Requirement |
|---|-------------|
| F-017 | New migration adding patient columns: `street`, `suburb`, `state`, `postcode`, `medicare_number`, `gp_name`, `gp_clinic`, `allergies` (text), `current_medications` (text), `known_conditions` (text), `onboarding_completed_at` (timestamptz nullable), `onboarding_skipped_steps` (jsonb default `'[]'`) |
| F-018 | `PATCH /api/v1/patients/me` extended to accept all new fields; validates Australian state enum and Medicare format |
| F-019 | `GET /api/v1/patients/me` returns all new fields plus a derived `completeness` object: `{percentage: number, missingRequired: string[], missingOptional: string[]}` |
| F-020 | New endpoint `POST /api/v1/patients/me/onboarding-step` records progression (`step: 1|2|3`, `skipped: boolean`, `skippedFields: string[]`) — used for analytics and to drive the persistent banner logic |
| F-021 | Doctor consultation detail (`GET /api/v1/doctor/consultations/:id`) returns `patient.clinicalContextWarnings: string[]` listing baseline fields the patient has skipped (e.g. "No allergies on file", "No current medications listed") |

### AI Assistant Integration

| # | Requirement |
|---|-------------|
| F-022 | `services/textConsultation.ts` and `services/geminiLive.ts` system prompts receive a structured pre-context block when starting a session: `{ageBand, sex, knownAllergies, currentMedications, knownConditions}`. PII (name, DOB, Medicare, address, phone) is **not** sent — only clinically-relevant baseline. PRD-006-style PII anonymiser invariants preserved |
| F-023 | If clinical baseline is empty (allergies / meds / conditions all missing), the AI's opening message asks for them inline rather than the patient having to type them unprompted |

### Doctor Queue

| # | Requirement |
|---|-------------|
| F-024 | Doctor queue row displays a small amber badge "Baseline incomplete" if the patient has any unfilled clinical-baseline field. Tooltip lists which |
| F-025 | Doctor consultation review screen surfaces `clinicalContextWarnings` prominently above the AI's SOAP note |

---

## State Machine — Onboarding Status

```
                  email verified
                        │
                        ▼
                   onboarding
                  (status: in_progress)
                        │
                ┌───────┼───────┐
                ▼       ▼       ▼
            step 1   step 2   step 3
            (any can be skipped — captured in skipped_steps[])
                        │
                        ▼
                   completed
              (onboarding_completed_at set)
                        │
                        ▼
            dashboard with welcome banner
                        │
                        ▼
            banner persists until missingRequired[] empty
```

Existing patients (created before PRD-023 ships) are treated as `onboarding_completed_at = NULL` with their existing fields preserved. Dashboard banner appears for them too, prompting backfill.

---

## Acceptance Criteria

- [ ] New account via `/register` lands on `/onboarding/welcome`, not `/dashboard`.
- [ ] Wizard captures all three steps' fields and persists to the patient record.
- [ ] Skipping any step advances the wizard but records the skip; required-field skips trigger a soft warning.
- [ ] Dashboard greets returning patients by first name once captured.
- [ ] Profile completeness percentage reflects actual filled fields (no hardcoded value).
- [ ] First-login welcome banner appears with a checklist of missing items; dismissable only when no required fields are missing.
- [ ] Doctor queue rows show "Baseline incomplete" badge when applicable.
- [ ] AI text and voice sessions receive a structured `pre-context` block including age band, sex, allergies, medications, conditions — and **never** name/DOB/Medicare/address/phone.
- [ ] Migration runs cleanly forward and includes a no-op down migration (consistent with existing migration style).
- [ ] All existing Vitest + Jest suites pass; new tests cover onboarding wizard navigation, completeness calculation, doctor queue badge.

---

## Open Questions

1. **Forced re-onboarding window for existing patients?** — proposal: soft only (banner + dashboard nag), no forced wizard. Confirm.
2. **Medicare format strictness** — accept 10 or 11 digits? Reject IRN suffix or accept it? Confirm with privacy/clinical advisor.
3. **State enum vs free text** — Australian states are a fixed set (NSW/VIC/QLD/WA/SA/TAS/ACT/NT); enum recommended for downstream filtering. Confirm.
4. **What constitutes "required" for doctor review** — first name, last name, DOB are clearly required. Is allergies-or-"none-known" mandatory before a doctor can approve? Likely yes — defer to Medical Director sign-off before final wiring.
5. **Should the AI assistant ever decline to start a consultation if onboarding incomplete?** — recommendation: no, always allow, but flag the consultation prominently for doctor review.
