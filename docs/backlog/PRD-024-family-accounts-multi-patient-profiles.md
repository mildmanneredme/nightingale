# PRD-024 — Family Accounts & Multi-Patient Profiles

> **Status:** Not Started — scoping document for review
> **Phase:** Phase 2 — post-beta
> **Type:** Build — Patient Experience + Identity Model + Compliance
> **Priority:** P2 — high commercial value (family is a primary use case for telehealth) but introduces real Privacy Act / AHPRA complexity that should not gate MVP
> **Owner:** CTO
> **Sprint:** TBD — depends on legal review of mature-minor consent and shared-record disclosure
> **Depends on:** PRD-023 (Patient Onboarding — clinical baseline data model is the per-patient unit this PRD multiplies)
> **Related:** PRD-006 (current single-patient registration model), UX-004 (paediatric guardian fields shipped — superseded by this PRD)

---

## Overview

Today, one Cognito identity equals one patient. The only family-related primitive is the `is_paediatric` flag with `guardian_*` fields, which assumes the child has their own login and a guardian's contact details on record. That model breaks down for the most common real-world cases:

- A parent managing healthcare for **one or more children** under a single login.
- Two parents who both need to manage the same child's record from their respective logins.
- An adult child managing healthcare for an **aging parent** under power-of-attorney or informal carer arrangements.
- A spouse with shared access to a partner's records (e.g. neurodivergent or chronically-ill partner).

This PRD scopes the data model, identity model, consent/disclosure controls, doctor-visibility implications, and migration paths required to support **family accounts** — one Cognito identity acting on behalf of multiple distinct patient profiles, with explicit per-relationship permissions and a clean audit trail.

This document is a **scoping draft**. It deliberately raises more questions than it answers; several decisions (especially around mature-minor consent thresholds and shared-record disclosure under APP 6) require formal legal sign-off before any of the implementation requirements below are committed to.

---

## Why this matters

- **Market reality.** Telehealth is consumed by households, not by individuals. A single mum with three kids should not need three logins to book three GP consultations. A son living interstate should be able to book a consultation for his elderly mother and join the call.
- **Conversion / activation.** The current single-patient model forces every household member to do the full onboarding wizard (PRD-023) under their own email. For a family of four, that is four separate signups before anyone is consulted. Family accounts let one adult onboard once and add dependants.
- **Clinical safety.** The doctor must always know **whose** symptoms are being described. Today the system has no way to express "this consultation is about my 8-year-old, not me" — the parent has to type it into the presenting complaint, which the AI may or may not anchor on. A first-class profile switcher makes this unambiguous.
- **Compliance.** The current model is silently non-compliant for paediatric flows. A 12-year-old listed as the "patient" with an adult email address technically has the adult listed as the data subject in our records — that is APP 1/3/6 territory and we are getting away with it because the cohort is small. Codifying the model now (before scale) is safer than retrofitting.

---

## Goals

1. **One login can manage multiple patient profiles** with explicit, auditable relationships.
2. **Two adults can co-manage** a shared dependant (e.g. both parents on the same child) without sharing a password.
3. **Disclosure is explicit and revocable** — every relationship records what the proxy can see, do, and be notified about, and the dependant (when of age) can revoke it.
4. **Doctors always know** which natural person is the patient in the consultation, which (if any) is the proxy talking on their behalf, and what consent governs the interaction.
5. **The audit log distinguishes** the actor (logged-in human) from the subject (whose record was touched) on every event.
6. **Paediatric-to-adult transition** has a defined, tested handoff at the AU mature-minor threshold (typically 14, with case-by-case capacity assessment per RACGP).

---

## Non-Goals

- **Group billing / family plans** — payment is PRD-007 territory; we will assume one billing identity per Cognito account at first, even if it covers multiple dependants.
- **Multi-tenant accounts (employer / school)** — explicitly out of scope; family is household-scale, not organisational.
- **Cross-family invitations beyond first degree** — e.g. niece/nephew, godchild, neighbour's kid. Phase 3 if ever.
- **Replacing the doctor/admin auth model** — this PRD is patient-side only.
- **Re-onboarding existing single-patient accounts into a family structure** — those accounts continue to work as-is; the family model is opt-in via "Add a family member" on the profile page.

---

## User Roles & Access

| Role | Definition |
|------|------------|
| **Account holder** | The Cognito identity. Always an adult (≥ 18). Can hold one **own** patient profile and zero or more **dependant** profiles. |
| **Dependant — minor** | A patient profile under the legal guardianship of one or more account holders. Has no Cognito identity until they turn 14 (mature minor) or 18. |
| **Dependant — incapacitated adult** | An adult patient managed by an account holder under power of attorney, formal carer arrangement, or informal carer arrangement with explicit consent. Requires uploaded supporting document or attestation. |
| **Co-manager** | A second account holder granted access to a dependant by the primary account holder. Same permissions as primary unless explicitly limited. |
| **Doctor** | Sees the patient (subject), the actor (proxy if applicable), and the consent basis on every consultation. |

---

## Functional Requirements

### Data model

| # | Requirement |
|---|-------------|
| F-001 | New `account_holders` table keyed by Cognito sub. The existing `patients.cognito_sub` becomes nullable; patients are now linked to account holders via a join table. |
| F-002 | New `account_patient_relationships` (account_holder_id, patient_id, relationship_type, granted_by_id, granted_at, revoked_at, permissions_jsonb). |
| F-003 | `relationship_type` enum: `self`, `parent_of`, `co_parent_of`, `legal_guardian_of`, `power_of_attorney_for`, `informal_carer_for`, `spouse_of`. |
| F-004 | `permissions_jsonb` per relationship: `{canViewClinicalRecord, canBookConsultations, canSpeakInConsultation, canReceiveNotifications, canManageBilling, canAddCoManager}`. Defaults vary by relationship_type (e.g. `parent_of` defaults to all true; `spouse_of` defaults to view + notifications only, requires explicit opt-in for clinical actions). |
| F-005 | Every `patients` row gets a `responsible_account_holder_id` denormalised pointer for fast lookups (the original creator / primary). |
| F-006 | Audit log gains `actor_account_holder_id` and `subject_patient_id` columns; existing `actor_id` is retained for backwards compatibility but deprecated. |

### Identity & switching

| # | Requirement |
|---|-------------|
| F-007 | Login lands on the account holder's **own** patient profile by default. |
| F-008 | A profile switcher lives in the top-right of the patient app, showing avatar + first name of every patient profile the account holder can act on. |
| F-009 | Switching profiles changes the active subject in a single client-side context; all subsequent API calls carry an `X-Acting-On-Patient-Id` header (server validates against the relationship). |
| F-010 | The current active profile is shown prominently throughout the app — the consultation start page, the dashboard greeting, and the doctor-facing surfaces. |
| F-011 | Active profile resets to "self" after each login — no sticky cross-session subject (defence against accidental cross-record actions). |

### Adding & inviting

| # | Requirement |
|---|-------------|
| F-012 | "Add a family member" flow on the profile page collects: relationship_type, dependant's name + DOB + sex, and (for incapacitated adult) attestation or upload. |
| F-013 | For minors, no email is required — the dependant is created under the account holder's umbrella and shares no login. |
| F-014 | "Invite a co-manager" flow sends an email to a second adult's address with a sign-up + accept-invite link. The second account holder, after signing up, gains access to the named dependants only. |
| F-015 | Co-manager invites expire after 7 days; primary can revoke any time before acceptance. |
| F-016 | All add/invite/revoke actions write to the audit log with explicit consent text shown to the user at the time of action. |

### Consent & disclosure

| # | Requirement |
|---|-------------|
| F-017 | When creating a dependant, the account holder must affirm a consent statement appropriate to the relationship_type (parent vs power-of-attorney vs informal carer have different copy). |
| F-018 | When a paediatric dependant turns 14, the account holder is notified that the child has reached the AU **mature minor** threshold and that ongoing default access requires the child's affirmation at next consultation. |
| F-019 | At 18, the dependant's record automatically detaches from the account holder unless explicit ongoing consent has been recorded by the dependant; default access is revoked. |
| F-020 | Each dependant has a "Disclosure to family" toggle visible on their profile (managed by the account holder for minors, by the patient themselves once self-managing). Granular per-co-manager. |
| F-021 | Doctor-side: "patient consented to family disclosure" badge visible on the consultation review screen so the doctor knows whether the response can be safely sent to a co-manager's inbox. |

### Doctor visibility (AHPRA-driven)

| # | Requirement |
|---|-------------|
| F-022 | Every consultation surfaced to a doctor displays both **subject** (the patient) and **actor** (the account holder running the session, if different). E.g. "Patient: Mia Citizen, age 6 — proxy: Sarah Citizen (mother)". |
| F-023 | Voice / text consultation transcripts include a system-injected first turn declaring the actor/subject relationship before the patient interview begins ("This consultation is being conducted by Sarah Citizen on behalf of her 6-year-old daughter Mia"). |
| F-024 | Doctor approve / amend / reject actions record both subject_patient_id and actor_account_holder_id; emails to the patient inbox carry both names where appropriate ("Sarah, here is Mia's assessment"). |
| F-025 | A doctor can flag a paediatric consultation as "Direct discussion with minor required" — when the parent is the proxy but the doctor needs the child's voice for a sensitive matter (sexual health, mental health, substance use). The platform should support a follow-up direct-to-minor channel without revealing content to the parent by default. |

### Notifications & billing

| # | Requirement |
|---|-------------|
| F-026 | Notifications fan out by `canReceiveNotifications` permission. By default both parents on a `parent_of` relationship receive consultation outcomes; co-managers can opt out per relationship. |
| F-027 | Billing remains per-account-holder for Phase 2; per-dependant invoicing is deferred. PRD-007 will need a follow-up to support multiple subjects under one charge. |
| F-028 | An account holder paying for a consultation explicitly sees which dependant the consultation is for in the receipt and inbox. |

### Migration & lifecycle

| # | Requirement |
|---|-------------|
| F-029 | Existing single-patient accounts: backfilled into the new model with one `account_holder` row + one `account_patient_relationships(self)` row. No user-visible change. |
| F-030 | Existing `is_paediatric` patients (where the child has a Cognito login under an adult's email): one-time migration prompt asking the adult to confirm relationship and re-affirm consent. Until confirmed, the paediatric record is read-only (no new consultations). |
| F-031 | A dependant can be **detached** by the account holder at any time. Detachment triggers a 30-day notice email and creates a stand-alone unverified account (the dependant must verify and claim it within 90 days, else the record is anonymised under PRD-006 retention rules). |
| F-032 | Account-holder soft-deletion (`deletion_requested_at`) does **not** cascade to dependant patient records — dependants must be re-assigned to a co-manager or detached first. The deletion request is rejected with a list of unresolved dependants. |

---

## Open Questions Requiring Sign-Off

These are blockers before the data model can be committed.

1. **Mature-minor age threshold.** RACGP guidance is "Gillick competence — case by case from age 14". Do we hard-code 14, 16, or implement a doctor-flagged competency assessment? Likely the latter, but the default age for the automated 'parent loses default access' nudge needs a number.
2. **Default disclosure for spouses.** APP 6 generally requires explicit consent for disclosure. Should `spouse_of` default to *no* clinical record access (only billing + notifications), with view access requiring explicit opt-in by the subject? Defaulting to access is a privacy footgun.
3. **Power-of-attorney verification.** Do we accept attestation only, or require an uploaded EPOA document? The latter creates a clinical-record-class document storage problem (SSE-KMS, retention, doctor visibility) we don't have today.
4. **Minor's right to private consultation.** A 14-year-old patient may want to discuss something the parent should not see (sexual health, mental health). The system must support this — but the parent is the account holder. How is the child given a private channel without giving them their own login? Possible answer: in-app one-time-link for the minor's device.
5. **Cross-border family.** A grandparent in Indonesia listed as `informal_carer_for` an Australian child — APP 8 cross-border disclosure trigger, even for read access. Block at the relationship-creation step or accept with explicit warning?
6. **Existing paediatric records under "adult's email".** We have an unknown number of these in staging today. Counting them and contacting the affected adults is a PRD-024 migration prerequisite.
7. **Doctor-flagged 'Direct discussion with minor required' (F-025).** Designing the privacy-preserving follow-up channel is non-trivial. Defer to a sub-PRD?

---

## Acceptance Criteria

To be defined once Open Questions above are resolved. Provisional minimum:

- [ ] One Cognito identity can hold N patient profiles via explicit relationships.
- [ ] Profile switcher works on web; active subject is unambiguous in the UI and on every API call.
- [ ] Two adults can co-manage one child; either can act, both are audit-tagged.
- [ ] Doctor queue and review screens display subject + actor on every consultation.
- [ ] Paediatric → adult auto-transition fires at the agreed age and detaches default access until reaffirmed.
- [ ] Audit log records actor + subject distinctly on every clinical event.
- [ ] Existing single-patient accounts migrate cleanly with no user-visible break.
- [ ] Privacy lawyer + Medical Director sign off on consent copy and default-permission matrix.

---

## Out of Scope

- Family group chat with the AI assistant (multiple subjects in one session).
- Sibling discounts or per-family pricing structures.
- Linking with My Health Record family member endpoints (post-Phase 2; depends on ADHA conformance).
- Wearable / vitals device sharing across family members.
- Insurance "family policy" integration.

---

## Risks

- **Privacy footgun.** The shared-record default for spouses or extended carers is the biggest design risk. Defaulting *open* invites APP 6 violations; defaulting *closed* makes the feature feel broken. Lean closed; require explicit opt-in.
- **Mature-minor handoff.** If a 15-year-old is accessing a discussion their parent should not see, and the parent has the only login, we have a confidentiality problem the platform structurally cannot solve without giving the minor their own channel. F-025 sketches a fix but is non-trivial.
- **Audit trail completeness.** Adding actor/subject distinction requires changes to *every* write path. Skipping any creates ambiguity in clinical records — a regulatory red flag. This work touches more files than its surface area suggests.
- **Backfill / migration risk.** Production patient data exists under the current single-patient assumption. Any wrong move during the migration corrupts clinical records. Should run shadow-write + verification before cutover.
- **Doctor cognitive load.** Adding subject/actor to every consultation surface helps clinical safety but adds visual density. Designs need to make the relationship instantly readable, not buried in metadata.
