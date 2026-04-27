# PRD-025 — Doctor Onboarding & Admin Verification

> **Status:** Draft
> **Phase:** Beta
> **Type:** Technical — Doctor Web App + Admin Portal + API + Auth
> **Owner:** CTO

---

## Overview

Project Nightingale needs a self-serve path for Australian doctors to apply to practise on the platform, plus an admin verification gate before any unverified doctor can act on a real consultation. Today, doctor accounts are admin-created out-of-band: the marketing page CTAs are `mailto:` links, the Cognito pre-signup Lambda blocks doctor self-registration, and the `doctors` table has no approval state.

This PRD defines a two-stage flow:
1. **Phase 1 — Self-serve application** with the minimum data set required for an admin to verify the applicant against AHPRA's public register of practitioners.
2. **Phase 2 — Admin verification** in the existing admin portal, controlling access to action endpoints (approve / amend / reject consultations, claim work, manage availability).

Pending doctors get an authenticated read-only experience that conveys "what's going on" without exposing PHI. Approved doctors get the existing full doctor experience. Rejected doctors get an explanation in-app and by email.

---

## Background

The existing doctor marketing page (`web/src/app/(marketing)/for-doctors/page.tsx`) has two CTAs — "Apply to Practice" and "Request a Clinical Demo" — both `mailto:`. The pre-signup Lambda (`infra/lambda/cognito-pre-signup/index.js:14-17`) defaults all self-registrations to `role=patient` and rejects attempts to set `role=doctor` or `role=admin`.

The `doctors` table (`infra/database/migrations/004_doctors.sql`) has no `status`, `approved_at`, or `rejection_reason` columns; once a row exists, the `requireRole("doctor")` middleware (`api/src/middleware/auth.ts:39-57`) lets the user reach every action endpoint in `api/src/routes/doctor.ts` (queue, approve, amend, reject, schedule).

Researched Australian comparators (Eucalyptus, InstantScripts, Updoc, Hub Health, Doctors on Demand) all do credentialing **offline** — the public-facing form is short and AHPRA-number-led; heavyweight verification (indemnity certificate, photo ID, AHPRA certificate PDF, Medicare provider number) happens after an in-principle approval. AHPRA's public register (https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx) is the canonical, sufficient identity check — name + AHPRA number returns registration type, specialty, conditions, undertakings, and suspensions.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Public (unauthenticated) | `/for-doctors` page; can submit a demo request; can begin a doctor application. |
| Doctor (pending) | Authenticated; sees own application status and a frosted, counts-only queue overview. **Cannot** view individual consultations, claim work, approve / amend / reject, or set availability. |
| Doctor (approved) | Existing full doctor experience: queue, consultation review, action endpoints, schedule. |
| Doctor (rejected) | Authenticated; sees rejection reason; cannot reapply in-app (must email admin). All action endpoints blocked. |
| Admin | New section listing pending applications; can approve or reject with reason. Cannot self-approve own application. |

---

## Functional Requirements

### Marketing page CTAs

| # | Requirement |
|---|-------------|
| F-001 | "Apply Now" button on `/for-doctors` links to `/register/doctor` (in-app signup). |
| F-002 | "Request a Demo" button on `/for-doctors` opens a form collecting: full name, email, AHPRA number (optional), specialty (optional), message (optional). |
| F-003 | Demo form submits to `POST /v1/marketing/demo-request`; the backend forwards the contents to `robert.s.xie@gmail.com` via SendGrid and returns 202 to the client. |
| F-004 | Demo form is rate-limited (5 / IP / hour) and CAPTCHA-protected at the same threshold as patient registration. |
| F-005 | The page copy near the Apply Now CTA explicitly states: "We collect the minimum information needed to verify your AHPRA registration. Heavier credentialing (indemnity, Medicare provider number, ID) happens after our team has confirmed you on the AHPRA register." |

### Doctor application form

| # | Requirement |
|---|-------------|
| F-006 | Page at `/register/doctor` collects: full legal name, email, mobile (AU, E.164), password, AHPRA registration number, specialty (enum), primary state of practice (enum), hours/week available (enum, optional). |
| F-007 | Field-level help text: AHPRA number labelled "Must match your name as it appears on the AHPRA public register"; mobile labelled "We use this only for account-recovery and clinical-urgency contact". |
| F-008 | Specialty enum: `GP-FRACGP` / `GP-FACRRM` / `GP-non-vocational` / `Specialist-other` / `Other`. |
| F-009 | Primary state enum: `NSW` / `VIC` / `QLD` / `WA` / `SA` / `TAS` / `ACT` / `NT`. |
| F-010 | Hours/week enum (optional): `0-10` / `10-20` / `20+`. |
| F-011 | AHPRA number client-side format validation: 3 letters + 10 digits (e.g. `MED0001234567`), case-insensitive, normalised to uppercase server-side. |
| F-012 | Privacy collection notice and Terms of Service shown and accepted before submission; acceptance timestamps recorded (PRD-005 pattern). |
| F-013 | Cognito `signUp` runs with `custom:role=doctor`; pre-signup Lambda is updated to allow this and assigns the user to the `doctors` Cognito group at confirmation. |
| F-014 | After Cognito email verification, the client calls `POST /v1/doctors/register` with the form payload; the backend creates a `doctors` row with `status='pending'`. |
| F-015 | Duplicate AHPRA numbers are rejected with a clear error: "An application with this AHPRA number already exists." |
| F-016 | On successful application, applicant lands on `/doctor/pending` (see below) and receives a "we received your application" email. |

### Pending doctor experience

| # | Requirement |
|---|-------------|
| F-017 | `/doctor/queue` for `status='pending'` users renders a frosted-glass overlay showing **counts only**: "Cases waiting for review (12)", "Average wait time (14 min)", "Cases reviewed today across the platform (47)". No patient initials, no presenting complaints, no consultation IDs. |
| F-018 | A persistent banner reads: "Your application is being reviewed. We're verifying your AHPRA registration. You'll receive an email when this is complete — usually within 1–2 business days." |
| F-019 | All action UI (Claim, Approve, Amend, Reject, Set availability) is hidden or visibly disabled with a tooltip "Available after verification". |
| F-020 | Top navigation suppresses links to consultation detail, schedule, and renewals queue for pending users. |
| F-021 | If the doctor's status changes to `rejected`, `/doctor/queue` redirects to `/doctor/rejected`, which shows the rejection reason verbatim and a "If you believe this is an error, contact applications@nightingale.health" line. |

### Backend gating

| # | Requirement |
|---|-------------|
| F-022 | New middleware `requireApprovedDoctor` (in `api/src/middleware/auth.ts`) loads the `doctors` row for the authenticated Cognito sub and rejects with `403` and `code: "DOCTOR_NOT_APPROVED"` unless `status='approved'`. |
| F-023 | `requireApprovedDoctor` applied to: `POST /v1/doctor/consultations/:id/approve`, `POST /v1/doctor/consultations/:id/amend`, `POST /v1/doctor/consultations/:id/reject`, `GET /v1/doctor/consultations/:id`, all `/v1/doctor/schedule/*` mutations, all `/v1/renewals/*` action endpoints. |
| F-024 | `GET /v1/doctor/queue` accepts a pending doctor but, when status is not `approved`, returns an aggregated counts payload only — no consultation rows. Field shape differs (`{ mode: "counts", waiting, avgWaitMinutes, reviewedTodayPlatform }` vs. `{ mode: "full", items, total }`). |
| F-025 | New `GET /v1/doctor/me` returns `{ status, rejectionReason | null, appliedAt, approvedAt | null }`. Used by the doctor frontend to drive banners and route guards. |
| F-026 | All action-endpoint blocks log an audit event `doctor.action_blocked_pending` with the attempted route — operational signal that gating is working. |

### Admin verification

| # | Requirement |
|---|-------------|
| F-027 | New page `/admin/doctors/applications` lists pending applications with: applicant full name, AHPRA number, specialty, state, applied-at, mobile, email. Sorted oldest-first. |
| F-028 | Each row has a "Open on AHPRA register" external link that opens `https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx` in a new tab (the admin then searches the practitioner manually — there is no public AHPRA API). |
| F-029 | Detail view shows the full application including hours/week, applied-at, IP address, and any prior application history for the same email or AHPRA number. |
| F-030 | Approve action requires the admin to tick a checkbox: "I have verified this AHPRA registration on the AHPRA public register and confirm the practitioner is currently registered with no suspensions or restrictions relevant to general practice." Submission without the tick is rejected. |
| F-031 | Approve sets `status='approved'`, `approved_at=NOW()`, `approved_by_admin_id=<admin's doctors row id or admin sub>`; writes audit event `doctor.application_approved`; sends approval email to doctor. |
| F-032 | Reject requires a free-text reason (10–500 chars). Sets `status='rejected'`, `rejected_at`, `rejection_reason`, `rejected_by_admin_id`; writes audit event `doctor.application_rejected` with the reason; sends rejection email containing the reason. |
| F-033 | An admin cannot approve or reject their own application (defence-in-depth — admins shouldn't have a `doctors` row, but the check is enforced anyway). |
| F-034 | The admin sidebar gains a "Doctor Applications" link with a badge showing pending count. |

### Email notifications

| # | Requirement |
|---|-------------|
| F-035 | `demo-request-internal.html` — to `robert.s.xie@gmail.com` — name, email, AHPRA, specialty, message, IP, user-agent. |
| F-036 | `doctor-application-received.html` — to applicant — confirms application received, expected timeline (1–2 business days), what we're verifying. |
| F-037 | `doctor-application-internal.html` — to `robert.s.xie@gmail.com` — new application notification with deep link to `/admin/doctors/applications/:id`. |
| F-038 | `doctor-approved.html` — to applicant — welcome, link to log in, brief on next steps (Phase-2 onboarding for indemnity / Medicare provider number lives outside this PRD). |
| F-039 | `doctor-rejected.html` — to applicant — rejection reason verbatim, contact email for queries. |

---

## Non-Functional Requirements

- **Data residency:** Application data, including mobile and AHPRA number, stored in RDS `ap-southeast-2`. No data leaves AU.
- **PII handling:** Doctor name, email, mobile, AHPRA number are PII but **not** patient health information; standard at-rest encryption (KMS) is sufficient; the PII anonymiser does not apply here (no LLM call carries this data).
- **PHI containment:** Pending doctors must never receive consultation-level PHI. The counts-only queue endpoint is the enforcement point; manual review before launch must confirm no other endpoint leaks.
- **Rate limiting:** `/v1/marketing/demo-request` and `/v1/doctors/register` carry the same per-IP limits as `/v1/patients/register`.
- **Audit:** Every state transition (`submitted`, `approved`, `rejected`, `action_blocked_pending`) writes an `audit_log` row with the actor sub, target doctor id, and AHPRA number.

---

## Data Model

New migration `infra/database/migrations/014_doctor_application_status.sql`:

```sql
ALTER TABLE doctors
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN mobile TEXT,
  ADD COLUMN specialty TEXT,
  ADD COLUMN primary_state TEXT,
  ADD COLUMN hours_per_week TEXT,
  ADD COLUMN applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by_admin_sub TEXT,
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejected_by_admin_sub TEXT,
  ADD COLUMN rejection_reason TEXT;

-- Backfill: any pre-existing doctors row is treated as already approved
-- so the gate doesn't break the existing queue for the founding doctor(s).
UPDATE doctors
   SET status = 'approved',
       approved_at = created_at
 WHERE status = 'pending';

CREATE UNIQUE INDEX doctors_ahpra_number_idx ON doctors (ahpra_number);
CREATE INDEX doctors_status_applied_at_idx ON doctors (status, applied_at);
```

---

## API Surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/marketing/demo-request` | Public + rate limited | Forwards demo request to admin email. |
| POST | `/v1/doctors/register` | Cognito JWT (any role) | Creates `doctors` row in `pending` for the authenticated user; idempotent on Cognito sub. |
| GET | `/v1/doctor/me` | Doctor | Returns own application status. |
| GET | `/v1/doctor/queue` | Doctor | Returns counts when pending, full list when approved. |
| GET | `/v1/admin/doctors/applications` | Admin | List of pending applications. |
| GET | `/v1/admin/doctors/applications/:id` | Admin | Application detail. |
| POST | `/v1/admin/doctors/applications/:id/approve` | Admin | Approves; requires `verifiedOnAhpraRegister: true`. |
| POST | `/v1/admin/doctors/applications/:id/reject` | Admin | Rejects with `reason`. |

---

## Doctor Onboarding UI — Key Screens

1. **`/for-doctors`** (existing) — wired-up Apply Now and Request a Demo CTAs.
2. **`/for-doctors` demo modal** — short form; SendGrid forwards on submit.
3. **`/register/doctor`** — application form (8 fields; Phase-1 minimum).
4. **`/register/doctor/verify`** — Cognito email-verification step (mirrors `/register/verify`).
5. **`/doctor/pending`** — landing for newly-applied / pending doctors; banner + frosted counts overlay over the queue page.
6. **`/doctor/rejected`** — shown when status is `rejected`; reason verbatim + contact line.
7. **`/admin/doctors/applications`** — list view with badge count.
8. **`/admin/doctors/applications/:id`** — detail + approve/reject controls + AHPRA register external link + verification checkbox.

---

## Compliance Notes

**HITL gate (CLAUDE.md non-negotiable rule #1):** Reinforced — only doctors with `status='approved'` can reach action endpoints. The middleware fails closed on missing `doctors` row.

**Pre-verification PHI exposure:** Counts-only queue is the architectural decision that keeps the platform's clinical-safety story consistent. No consultation, patient initials, or presenting complaint reaches a doctor before the admin has confirmed the AHPRA registration.

**AHPRA advertising rules:** Marketing copy (CTAs, application page, emails) does not make claims about doctor outcomes or platform efficacy. The "we verify your AHPRA registration" wording is factual.

**Audit log events** (all written to `audit_log`, append-only):

| Event | Trigger | Fields |
|-------|---------|--------|
| `doctor.demo_requested` | Demo form submission | name, email, ip |
| `doctor.application_submitted` | `POST /v1/doctors/register` | doctor_id, ahpra_number, applied_at |
| `doctor.application_approved` | Admin approves | doctor_id, ahpra_number, admin_sub, verified_on_ahpra_register=true |
| `doctor.application_rejected` | Admin rejects | doctor_id, ahpra_number, admin_sub, reason |
| `doctor.action_blocked_pending` | Pending doctor hits a gated route | doctor_id, attempted_route |

**Data retention:** Rejected applications retained 7 years for medicolegal traceability (matches patient-record retention).

---

## Acceptance Criteria

- [ ] "Apply Now" on `/for-doctors` navigates to `/register/doctor` (no `mailto:`).
- [ ] "Request a Demo" submits a form; SendGrid delivers a notification to `robert.s.xie@gmail.com`.
- [ ] A new applicant can complete `/register/doctor`, verify their email, and land on `/doctor/pending`.
- [ ] An applicant with a duplicate AHPRA number sees a clear error and is not given an account.
- [ ] Pending doctor's `/doctor/queue` shows counts only; no patient initials or presenting complaints anywhere in the response payload (verified via Playwright network assertion).
- [ ] Pending doctor's attempt to `POST /v1/doctor/consultations/:id/approve` returns `403 DOCTOR_NOT_APPROVED` and writes `doctor.action_blocked_pending`.
- [ ] Admin sees the new application at `/admin/doctors/applications` within 5 seconds of submission.
- [ ] Admin cannot submit the approve modal without ticking the AHPRA-verification checkbox.
- [ ] Approve transitions status to `approved`, sends the approval email, writes `doctor.application_approved` to audit, and unlocks the queue + action endpoints on the doctor's next request.
- [ ] Reject with reason transitions to `rejected`, sends the rejection email containing the reason, writes `doctor.application_rejected`, and the doctor sees the reason on `/doctor/rejected`.
- [ ] Pre-existing doctors (data-migrated to `status='approved'`) experience no behavioural change.
- [ ] All flows usable on a 375px-wide mobile browser.

---

## Dependencies

- PRD-004 (Auth) — Cognito user pool, pre-signup Lambda, role-claim middleware.
- PRD-005 (Audit log) — append-only event store; new event types added.
- PRD-013 (Doctor review dashboard) — queue and action endpoints being gated.
- PRD-022 (Public marketing site) — host of `/for-doctors`.
- UX-003 (Admin portal) — pattern reused for the new applications page.

---

## Out of Scope (Phase 2 onboarding)

- Heavier post-approval credentialing form: Medicare provider number, PBS prescriber number, indemnity insurer + certificate-of-currency upload, AHPRA certificate of registration upload, photo ID upload, headshot for patient-facing attribution, bank / ABN / super for payouts.
- Automated AHPRA verification (no public API exists; admin manual check is the canonical mechanism).
- Reapplication flow after rejection (rejected applicants must email admin).
- Multi-admin reviewer workflow / approval quorum.
- SMS verification of mobile number.
- Periodic re-verification of AHPRA status (scheduled job to flag suspensions / undertakings post-approval).
- Doctor-side "edit my application" before approval.
