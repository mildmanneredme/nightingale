# PRD-024 — Family Accounts & Multi-Patient Profiles

> **Status:** Ready for sprint planning — open questions resolved 2026-04-26 (CTO)
> **Phase:** Phase 2 — post-beta
> **Type:** Build — Patient Experience + Identity Model + Compliance
> **Priority:** P2 — high commercial value (family is a primary use case for telehealth) but introduces real Privacy Act / AHPRA complexity that should not gate MVP
> **Owner:** CTO
> **Sprint:** TBD — depends on legal review of consent copy + default-permission matrix
> **Depends on:** PRD-023 (Patient Onboarding — clinical baseline data model is the per-patient unit this PRD multiplies), PRD-014 (Notifications — invite emails)
> **Related:** PRD-006 (current single-patient registration model), UX-004 (paediatric guardian fields shipped — superseded by this PRD)

---

## Overview

Today, one Cognito identity equals one patient. The only family-related primitive is the `is_paediatric` flag with `guardian_*` fields, which assumes the child has their own login and a guardian's contact details on record. That model breaks down for the most common real-world cases:

- A parent managing healthcare for **one or more children** under a single login.
- Two parents who both need to manage the same child's record from their respective logins.
- An adult child managing healthcare for an **aging parent** — done by inviting the parent to create their own account that the adult child is then linked to.
- A spouse who needs visibility on a partner's records (e.g. neurodivergent or chronically-ill partner) — done by the partner inviting the spouse and granting access.

This PRD scopes the data model, identity model, consent/disclosure controls, doctor-visibility implications, and migration paths required to support **family accounts** — one Cognito identity acting on behalf of multiple distinct patient profiles, with explicit per-relationship permissions and a clean audit trail.

---

## Design decisions (resolved 2026-04-26)

These decisions were locked in by the CTO in response to the original scoping draft's open questions. They simplify the model significantly compared to the first draft.

| # | Decision | Implication |
|---|---|---|
| D-1 | **Minors are flagged, not age-gated.** No automated "parent loses default access at 14/16/18". The platform shows a minor flag on the dependant's profile; the minor can be promoted to their own login at any time by the account holder. | Removes the mature-minor age-cutoff state machine entirely. |
| D-2 | **Spouses default to NO clinical access.** Default permissions for a `spouse` relationship are notifications + billing only. Clinical record view requires explicit opt-in by the subject. | APP 6 footgun closed. |
| D-3 | **No EPOA / informal-carer relationship types.** Every adult dependant must self-sign-up via emailed invite and explicitly accept the link. The primary cannot create an adult dependant unilaterally. | Removes EPOA document upload, removes the standalone POA verification surface, removes the "shadow account" risk. |
| D-4 | **Minors get their own login when private channels are needed.** A teenager who wants confidential consults gets a separate Cognito account managed by the parent (parent sets up + helps verify). For everything else, the minor is a `parent_of` dependant under the parent's umbrella. | F-025 ("Direct discussion with minor required") now resolves naturally — the minor's login is the channel. |
| D-5 | **Cross-border family is blocked at relationship-creation.** No invites can be sent to addresses outside Australia. We pin to the most conservative option for Phase 2; revisit only with explicit legal sign-off. | Sidesteps APP 8 cross-border disclosure entirely. |
| D-6 | **Assume no existing paediatric-under-adult-email records to migrate.** Production and staging data is small enough that we can assert this is true; if any are found during pre-launch audit they'll be handled manually. | Removes F-030 from the original draft. |
| D-7 | **F-025 doctor "direct discussion with minor required" pushes via the minor's personal account.** Only available where the minor has their own login (per D-4). For minors without a login, the doctor cannot enable a private channel — they must request the parent set one up first. | Aligns the privacy model with the identity model. |

---

## Goals

1. **One login can manage one or more patient profiles** (own + child dependants), and can hold links to other adults' profiles via mutual consent.
2. **Two adults can co-manage the same child** without sharing a password — by both having their own logins both linked to the same child dependant.
3. **Disclosure is explicit and revocable** — every relationship records what the proxy can see, do, and be notified about. The subject can revoke any link at any time.
4. **Doctors always know** which natural person is the patient in the consultation, who (if anyone) is the proxy talking on their behalf, and what consent governs the interaction.
5. **The audit log distinguishes** the actor (logged-in human) from the subject (whose record was touched) on every event.

---

## Non-Goals

- **Mature-minor age-cutoff state machine** — D-1.
- **EPOA / informal-carer document storage** — D-3.
- **Group billing / family plans** — payment is PRD-007 territory; we will assume one billing identity per Cognito account at first, even if it covers minor dependants.
- **Multi-tenant accounts (employer / school)** — explicitly out of scope; family is household-scale, not organisational.
- **Cross-border family** — D-5.
- **Replacing the doctor/admin auth model** — this PRD is patient-side only.

---

## Identity Model

```
Cognito identity (1)  ──owns──▶  Account holder (1)
                                       │
                                       ├──self──▶  Patient profile  (account holder's own)
                                       │
                                       ├──parent_of (umbrella)──▶  Patient profile  (minor, no login)
                                       ├──parent_of (umbrella)──▶  Patient profile  (minor, no login)
                                       │
                                       └──linked_to (mutual consent)──▶  Patient profile  (other adult OR
                                                                                            promoted minor —
                                                                                            has own Cognito login)

A linked patient is owned by ANOTHER account holder. The link grants the
viewer permission per the permissions JSONB, but the patient's record
remains under the subject's own account. Either side can revoke the link
at any time.
```

---

## User Roles & Access

| Role | Definition |
|------|------------|
| **Account holder** | The Cognito identity. Always an adult (≥ 18, attested at sign-up). Owns their own patient profile and zero-or-more child dependants. May be linked to other adults' profiles via accepted invites. |
| **Self profile** | The patient profile owned by the account holder themselves. There is exactly one per Cognito identity. |
| **Child dependant** | A minor patient profile created under an account holder's umbrella. No Cognito identity unless promoted (D-4). |
| **Linked profile** | Any patient profile (own or child dependant) that another account holder has been granted access to via accepted invite. |
| **Doctor** | Sees the subject (the patient) and the actor (the account holder running the session, if different). |

---

## Functional Requirements

### Data model

| # | Requirement |
|---|-------------|
| F-001 | New `account_holders` table keyed by Cognito sub. The existing `patients.cognito_sub` column is removed; ownership is established via a join to `account_holders`. |
| F-002 | New `account_patient_links` table (`account_holder_id`, `patient_id`, `relationship_type`, `granted_by_id`, `granted_at`, `revoked_at`, `permissions_jsonb`). One row per (viewer, subject) pair. The subject's *own* link to themselves uses `relationship_type = 'self'`. |
| F-003 | `relationship_type` enum: `self`, `parent_of`, `child_of`, `spouse_of`, `family_other`. (No `power_of_attorney_for`, `informal_carer_for`, `legal_guardian_of`, `co_parent_of` — D-3.) |
| F-004 | `permissions_jsonb` per link: `{canViewClinicalRecord, canBookConsultations, canSpeakInConsultation, canReceiveNotifications, canManageBilling, canAddCoManager}`. Default matrix: `parent_of` (minor under umbrella) → all true; `spouse_of` → notifications + billing only (D-2); `family_other` → notifications only; subject must opt in for any clinical permission. |
| F-005 | Every `patients` row gets an `is_minor` BOOLEAN (D-1). Defaults to false for self profiles created at sign-up, true for child dependants. Visible on doctor surfaces; not used for any automated state transitions. |
| F-006 | Every `patients` row gets a `responsible_account_holder_id` denormalised pointer for fast lookups (the original creator / owner). For child dependants this is the parent who created them; for self profiles this is the account holder themselves. |
| F-007 | Audit log gains `actor_account_holder_id` and `subject_patient_id` columns; existing `actor_id` is retained for backwards compatibility but deprecated. |

### Identity & switching

| # | Requirement |
|---|-------------|
| F-008 | Login lands on the account holder's **self profile** by default. |
| F-009 | A profile switcher lives in the top-right of the patient app, showing avatar + first name of every patient profile the account holder can act on (own + child dependants + linked profiles). |
| F-010 | Switching profiles changes the active subject in a single client-side context; all subsequent API calls carry an `X-Acting-On-Patient-Id` header (server validates against the link). |
| F-011 | The active profile is shown prominently throughout the app — the consultation start page, the dashboard greeting, and the doctor-facing surfaces. |
| F-012 | Active profile resets to "self" after each login — no sticky cross-session subject (defence against accidental cross-record actions). |
| F-013 | If `is_minor` is true, the profile switcher tile and consultation-start banner show a "Minor — under your care" badge (D-1). |

### Adding child dependants (no login)

| # | Requirement |
|---|-------------|
| F-014 | "Add a child" flow on the profile page collects: first name, last name, DOB, biological sex. No email is required — the minor lives entirely under the account holder's umbrella. |
| F-015 | The account holder must affirm a parental-responsibility consent statement at creation. |
| F-016 | The created child profile inherits all the same clinical-baseline structure as a self profile (allergies, medications, conditions). The wizard equivalent for a child runs in a dialog, not a full screen. |

### Promoting a child to their own login

| # | Requirement |
|---|-------------|
| F-017 | "Give this child their own login" action on a child dependant. Account holder enters the child's email (or their own email aliased), then triggers the standard sign-up + verify flow on behalf of the child. |
| F-018 | Once verified, the existing child patient record is re-attached to the new account holder (the minor) as their `self` profile. The original parent retains a `parent_of` link to the now-promoted profile with full default permissions. |
| F-019 | After promotion, the doctor "direct discussion with minor required" flag (F-031) becomes available — without promotion this option is greyed-out (D-7). |

### Inviting another adult to link

| # | Requirement |
|---|-------------|
| F-020 | "Invite a family member" flow on the profile page collects: invitee email, relationship_type (`spouse_of` / `family_other` / inverse-`parent_of` for an adult parent), and which patient profile(s) the link covers (subject can be self, a child dependant, or both). |
| F-021 | Invite creates a `pending_invite` row and sends an email with a sign-up + accept-invite link. Recipient must complete sign-up (or sign in if they already have an account) and explicitly tap "Accept link to {Subject Name}". |
| F-022 | Cross-border block (D-5): invites with email TLDs outside the AU/NZ/UK/US/CA whitelist are rejected at submit-time with a clear "Family accounts are only available within Australia in Phase 2" message. (Permissive TLD whitelist; geo-IP enforcement is out of scope for Phase 2.) |
| F-023 | Co-manager invites expire after 7 days. The inviter can revoke any time before acceptance. |
| F-024 | All add / promote / invite / accept / revoke actions write to the audit log with the explicit consent text shown to the user at the time of action. |

### Consent & disclosure

| # | Requirement |
|---|-------------|
| F-025 | When inviting another adult, the inviter sees a clear preview of what the recipient will be able to see and do under the proposed permissions (the default per-relationship matrix is shown and is editable). |
| F-026 | The recipient, when accepting, sees the same preview and must explicitly tap "Accept" — no implicit consent. |
| F-027 | The subject can revoke any link from their own profile at any time. Revocation immediately removes API access; in-flight consultations are not retroactively affected. |
| F-028 | Doctor-side: a "subject consents to family disclosure" indicator is visible on the consultation review screen so the doctor knows which (if any) other account holders may receive the response. |

### Doctor visibility (AHPRA-driven)

| # | Requirement |
|---|-------------|
| F-029 | Every consultation surfaced to a doctor displays both **subject** (the patient) and **actor** (the account holder running the session, if different). E.g. "Patient: Mia Citizen, age 6 — proxy: Sarah Citizen (mother)". |
| F-030 | Voice / text consultation transcripts include a system-injected first turn declaring the actor/subject relationship before the patient interview begins ("This consultation is being conducted by Sarah Citizen on behalf of her 6-year-old daughter Mia"). |
| F-031 | A doctor can flag a consultation as "Direct discussion with minor required" — only enabled when the minor has their own login per D-7. Flag triggers a follow-up notification to the minor's own inbox; the parent sees the existence of the follow-up but not the content (subject + actor distinction in the audit log keeps this clean). |
| F-032 | Doctor approve / amend / reject actions record both `subject_patient_id` and `actor_account_holder_id`; emails to the inbox carry both names where appropriate ("Sarah, here is Mia's assessment"). |

### Notifications & billing

| # | Requirement |
|---|-------------|
| F-033 | Notifications fan out by `canReceiveNotifications` permission. By default both account holders linked to a child dependant receive consultation outcomes; either can opt out per link. |
| F-034 | Billing remains per-account-holder for Phase 2; per-dependant invoicing is deferred. PRD-007 will need a follow-up to support multiple subjects under one charge. |
| F-035 | An account holder paying for a consultation explicitly sees which subject the consultation is for in the receipt and inbox. |

### Migration & lifecycle

| # | Requirement |
|---|-------------|
| F-036 | Existing single-patient accounts: backfilled into the new model with one `account_holder` row + one `account_patient_links(self)` row. No user-visible change. |
| F-037 | Per D-6 we assume no existing paediatric-under-adult-email records. A pre-launch audit query will count them; if non-zero we resolve manually before cutover. |
| F-038 | A child dependant can be **detached** by the account holder at any time. Detachment soft-deletes the dependant record (per the existing 7-year retention policy) and emails the account holder a confirmation. |
| F-039 | An account holder soft-deletion (`deletion_requested_at`) does **not** cascade to their child dependants — the account holder must either detach each dependant or hand them off to a co-manager (via promote + invite) first. The deletion request is rejected with a list of unresolved dependants. |
| F-040 | A linked profile (other adult) can revoke the link from either side at any time. Revocation does not affect the underlying patient record on either side. |

---

## Acceptance Criteria

- [ ] One Cognito identity can hold N patient profiles via explicit links, and switch active subject in the patient app.
- [ ] Profile switcher works on web; active subject is unambiguous in the UI and on every API call.
- [ ] Two adults can both be linked to the same child dependant; either can act, both are audit-tagged.
- [ ] Doctor queue and review screens display subject + actor on every consultation; minor flag visible where applicable.
- [ ] Audit log records actor + subject distinctly on every clinical event.
- [ ] Existing single-patient accounts migrate cleanly with no user-visible break.
- [ ] Cross-border invites are rejected at submit-time with the documented message.
- [ ] Privacy lawyer + Medical Director sign off on consent copy and the default-permission matrix.

---

## Out of Scope

- Mature-minor age-cutoff handoff (D-1).
- EPOA document storage / verification (D-3).
- Family group chat with the AI assistant (multiple subjects in one session).
- Sibling discounts or per-family pricing structures.
- Linking with My Health Record family-member endpoints (post-Phase 2; depends on ADHA conformance).
- Wearable / vitals device sharing across family members.
- Insurance "family policy" integration.

---

## Risks

- **Privacy footgun on linked-adult permissions.** Defaulting `spouse_of` to no-clinical-access (D-2) closes the worst case, but the inviter must clearly understand what they're not granting by default. Consent-preview UI (F-025/F-026) is the load-bearing mitigation.
- **Audit-trail completeness.** Adding actor/subject distinction requires changes to *every* write path. Skipping any creates ambiguity in clinical records — a regulatory red flag. This work touches more files than its surface area suggests; should be one focused sprint, not interleaved with other work.
- **Backfill / migration risk.** Production patient data exists under the current single-patient assumption. The F-036 backfill must run shadow-write + verification before cutover; one bad migration corrupts clinical records.
- **Doctor cognitive load.** Adding subject/actor + minor flag + consent indicator to every consultation surface helps clinical safety but adds visual density. Designs need to make the relationship instantly readable, not buried in metadata.
- **Promote-child-to-login flow is the messiest UX.** The parent setting up an email + verifying it on behalf of a 14-year-old, then handing over the credentials, has many failure modes (parent forgets to hand over, parent retains password, child loses access). Should ship behind a feature flag and validated with a small cohort before general availability.

---

## Remaining Clarifications (post-decisions)

These follow-up questions surfaced after applying the seven decisions above. None block scoping but should be resolved before the implementation sprint starts.

1. **TLD whitelist for cross-border block (F-022).** AU/NZ/UK/US/CA is a starting point — confirm with legal whether US/CA should be included for "Australians overseas" cases.
2. **Adult-attestation at sign-up.** Today the register form has no age affirmation. To meet the "always an adult" constraint for account holders, do we add a birth-year field at sign-up, or is the implicit attestation in the Privacy Policy sufficient?
3. **Spouse default-permission UI copy.** Default = notifications + billing only. The consent-preview screen needs language that explains why "view my clinical record" is off by default without sounding accusatory.
4. **Promote-child flow at what age?** Technically promotable at any age, but presenting that option for a 4-year-old feels wrong. Soft-recommendation in the UI to wait until ~12+ — confirm with Medical Director.
5. **Doctor "subject consents to family disclosure" indicator (F-028).** Where exactly on the review screen — alongside red flags / clinical-context warnings, or in a dedicated "Disclosure" panel? Designer call.
