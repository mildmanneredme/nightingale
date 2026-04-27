# UX-005 — Auth Flow Polish

> **Status:** Not Started
> **Phase:** UX Fixes — onboarding-adjacent
> **Type:** UX — Patient Experience
> **Priority:** P2 — fix before scaling beyond pilot cohort
> **Owner:** CTO
> **Sprint:** TBD
> **Related:** BUG-001 (auth navigation hardening — already shipped), BUG-003 (forgot password — already shipped), BUG-007 (placeholder removal), PRD-023 (onboarding wizard)

---

## Overview

Several rough edges remain in the registration and login flow after BUG-001 and BUG-003. None individually block sign-up, but together they create a fragile first impression and produce avoidable support requests. This bundle addresses the four most common friction points observed during staging walkthroughs.

---

## Issues

### Issue 1 — No "Resend Code" Button on Verify Step

**Description.** Step 2 of `/register` shows the 6-digit code form but offers no way to resend the code if the email never arrives or expires. Users hit the dead-end of an empty inbox with no recovery path.

**Impact.** Forces users to start over (which itself dead-ends — see Issue 2). Likely produces "I never got a code" support tickets and abandoned signups.

**Proposed fix.** Add a "Resend code" link below the code input that calls Cognito's `resendConfirmationCode`. Apply a 60-second cooldown to prevent abuse. Show inline confirmation when sent.

---

### Issue 2 — Verify "Back" Button Creates a Dead End

**Description.** Step 2's "← Back" button reverts to Step 1 and clears the code, but Cognito has already created the user. Re-submitting Step 1 with the same email throws `UsernameExistsException` (now mapped to a friendly "An account with this email already exists. Please sign in instead." per BUG-001) — but this is misleading: the user **just** created this account moments ago and hasn't verified it yet.

**Impact.** Users who realise mid-verify that they used the wrong email have no clean way to start over with a different email. Their only options are: log in (impossible — not verified), reset password (impossible — not verified), or wait for Cognito's unverified-account TTL.

**Proposed fix.** On Step 2, replace "← Back" with two clearer affordances:
- "Resend code" (Issue 1 — same email, just send another code).
- "Use a different email" — calls Cognito's `deleteUser` against the unverified account if possible (or otherwise just routes the user to a clear "contact support if your account is stuck" copy), then returns to Step 1.

Removing the misleading back button is the minimum acceptable fix. Adding the unverified-account self-service deletion is the preferred fix.

---

### Issue 3 — Password Requirements Shown as Placeholder Only

**Description.** Step 1 password input shows "Min. 12 characters" as placeholder text, but no live validation. Users enter a 10-character password, click "Create Account", and only then see the Cognito error mapped to "Password does not meet requirements. Use at least 8 characters." (which is also wrong — the placeholder said 12, the error says 8).

**Impact.** Avoidable form-submission errors; mixed messaging undermines trust.

**Proposed fix.**
- Show a live checklist below the password input as the user types: ≥ 12 characters, contains uppercase, contains lowercase, contains number, contains symbol — each lighting up green as satisfied.
- Match the checklist to the actual Cognito User Pool password policy (currently set in `infra/terraform/modules/cognito/`). If the policy is "8 characters, mixed types", update the placeholder and checklist to match. If the intent is 12, update the Cognito policy.
- "Create Account" button disabled until all checklist items are green.

---

### Issue 4 — Inconsistent Fee Messaging Across Surfaces

**Description.** The $50 consultation fee appears in three different places with three different framings:
- Landing CTA: `Get Started ($50)` — implies $50 to sign up.
- Register form: no mention of any fee.
- New consultation page: `$50 AUD — payment is only collected after your consultation if a diagnosis is reached.`

**Impact.** A user clicking "Get Started ($50)" reasonably expects to pay $50 to register. They register, see no charge, then see the fee again at consultation start with a different conditional ("only if a diagnosis is reached"). The journey looks either deceptive or buggy.

**Proposed fix.** Pick one canonical source of truth (the new-consultation page) and remove fee references everywhere else:
- Landing CTA → `Get Started` (no parenthetical).
- Register form → no fee copy.
- Pricing page (`/pricing`) → keeps the $50 + conditional billing copy as the formal pricing surface.
- New-consultation page → keeps the $50 + conditional copy.

Once payments ship (PRD-007), revisit and align with the actual billing flow.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Verify step exposes a "Resend code" link below the code input |
| F-002 | Resend has a 60-second client-side cooldown; backend enforces Cognito's own rate limit |
| F-003 | Successful resend shows inline confirmation copy |
| F-004 | Verify step "← Back" is removed; replaced with "Use a different email" affordance |
| F-005 | "Use a different email" attempts to delete the unverified Cognito account, then returns the user to Step 1 with a fresh form |
| F-006 | Password input shows a live requirements checklist matching Cognito User Pool policy |
| F-007 | Submit button is disabled until all password requirements are met |
| F-008 | Cognito User Pool password policy and the placeholder/checklist text are reconciled — only one number of characters (no "12 in placeholder, 8 in error") |
| F-009 | Landing CTA reads `Get Started` with no fee parenthetical |
| F-010 | Register form contains no fee copy |
| F-011 | New-consultation page and `/pricing` remain the only fee-bearing surfaces |

---

## Out of Scope

- Forgot-password flow (BUG-003 — already shipped).
- Magic-link / passwordless auth (Phase 2 consideration).
- MFA enrolment for patients (Phase 2 — currently doctor/admin only).
- Social sign-in (Google / Apple) — explicit non-goal for Phase 1 due to APP 8 considerations.

---

## Acceptance Criteria

- [ ] "Resend code" works on the verify step, with cooldown and confirmation copy.
- [ ] "Use a different email" cleanly returns the user to Step 1 without leaving an unverified account stuck.
- [ ] Live password requirements checklist matches Cognito policy and disables submit until satisfied.
- [ ] No fee copy appears on the landing page CTA or register form.
- [ ] Cognito policy and frontend hint text agree on the same character minimum.
- [ ] Vitest suite covers cooldown timing, password checklist, and verify-step affordance changes.
- [ ] Manual smoke: register with a typo'd email → "Use a different email" → fresh Step 1 with correct email succeeds.
