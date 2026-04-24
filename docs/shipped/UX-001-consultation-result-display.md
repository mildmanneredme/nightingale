# UX-001 — Consultation Result & State Display

> **Status:** Not Started
> **Phase:** UX Fixes — Sprint 7
> **Type:** UX — Clinical Safety
> **Priority:** P0 — Must ship before any real patients are onboarded
> **Owner:** CTO
> **Covers audit findings:** SEC-003 (Amended consultations invisible), UX-002 (Rejected shows "Under Review"), UX-005 (Text no end button), UX-007 (No error pages)

---

## Overview

The patient-facing consultation result page has three clinically significant display gaps: amended consultations are invisible, rejected consultations show an incorrect "under review" state, and the text chat fallback has no manual exit. Combined, these mean patients with an amended response never see it, patients who should seek in-person care are told to keep waiting, and patients in a stalled text consultation have no way to proceed. This PRD also covers proper error and not-found states across the frontend.

---

## Background

The result page (`web/src/app/(patient)/consultation/[id]/result/page.tsx`) was built to handle the initial happy path (approved) and the two rejection variants defined at engine output time (emergency_escalated, cannot_assess). The subsequent status states introduced by PRD-013 (amended, rejected) and the clinical edge cases were not fully wired into the frontend. These are not minor display bugs — they directly affect whether a patient receives their clinical response and whether they take the right action after a rejection.

---

## Issue 1 — Amended Consultations Invisible to Patients (Clinical Safety)

### Description

The result page renders the consultation response only when `status === "approved"`. Status `"amended"` — when a doctor edits the AI draft before approving — falls through to the default "Under Review" spinner. A patient who receives a response-ready email, clicks through to the app, and has an amended consultation sees "Your consultation is being reviewed by a registered GP. You'll receive your assessment within a few hours." — indefinitely.

### Impact

This is a clinical safety issue. The patient has a doctor's response available but cannot access it through the app. They may take no action, or may assume there is a system error and seek alternative care without reading the clinical advice. The doctor draft (`doctor_draft` field) is already returned by the API — it is simply not rendered.

### Proposed Fix

Extend the result page condition to `status === "approved" || status === "amended"` and render `doctor_draft` (amended text) when the status is amended, with a UI label indicating the response was reviewed and amended by the doctor.

---

## Issue 2 — Rejected Consultations Show "Under Review"

### Description

Status `"rejected"` — set when a doctor actively declines a consultation with a reason — also falls through to the "Under Review" spinner. A patient who has been rejected receives a rejection email, but if they open the app (which is the natural next step), they see a pending state. This is misleading and potentially dangerous: the correct response to rejection is to seek in-person care, but the app implies the assessment is still coming.

### Impact

A patient in a critical situation who checks the app after reading a rejection email sees "You'll receive your assessment within a few hours." This contradicts the email content, creates confusion, and may delay the patient seeking in-person care that was explicitly recommended in the rejection. This is a direct patient safety risk.

### Proposed Fix

Add an explicit `status === "rejected"` branch to the result page that:
- Displays the rejection reason (`rejection_message`) if the doctor provided one
- States clearly that a remote assessment was not possible and a refund has been initiated
- Directs the patient to seek in-person care, with a link to HealthDirect (1800 022 222) as a next step
- Matches the tone and content of the rejection email already sent

---

## Issue 3 — Text Consultation Has No Manual End Button

### Description

The text chat fallback (`web/src/app/(patient)/consultation/[id]/text/page.tsx`) transitions to the result page only when the AI returns `type: "complete"`. There is no UI button for the patient to manually end the session. If the AI fails to send a completion signal — due to a network timeout, a model error, or an unexpected response — the patient is stranded on the chat screen with no way to proceed.

### Impact

A stranded patient has submitted their symptoms but cannot advance to doctor review. They see an active chat with no indication that anything is wrong and no way to escalate. The consultation stays in an intermediate state, never entering the doctor queue. The patient may wait hours before contacting support, during which time they're not receiving care.

### Proposed Fix

Add a "Finish Consultation" button to the text chat UI — visible once the patient has sent at least one message. On click, this calls the existing consultation end endpoint (the same one used by the voice flow) and navigates to the result page. The button should be secondary in visual priority (so it doesn't encourage premature ending) but clearly accessible. Match the pattern and UX of the voice consultation's "End Consultation" button.

---

## Issue 4 — No Proper Not-Found or Error Pages

### Description

Several frontend pages handle the case of a missing or inaccessible consultation with inline bare text (`<p>Consultation not found.</p>`) rendered mid-page with no navigation context, no branded styling, and no recovery path. There is no global `not-found.tsx` page in the Next.js app router.

### Impact

A patient navigating to an expired URL, an incorrectly shared link, or a consultation that belongs to another account sees a plain unstyled text message. This is jarring, unprofessional, and could cause loss of trust in a health platform where patients are already anxious. It also leaves the patient with no clear recovery path back to their dashboard.

### Proposed Fix

1. Create `web/src/app/not-found.tsx` as a Next.js app-router not-found page with Nightingale branding, a clear "Page not found" message, and a "Go to Dashboard" link.
2. Create a reusable `<ErrorState>` component for use within individual pages (e.g., "Consultation not found" within the result page layout) that renders consistently with the design system.
3. Replace all bare inline error text with the `<ErrorState>` component.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Result page renders the doctor's amended response when `status === "amended"`, using the `doctor_draft` field |
| F-002 | Amended consultation result is labelled "Reviewed and amended by a registered GP" to distinguish from an unchanged approval |
| F-003 | Result page renders an explicit rejection state when `status === "rejected"`, including the rejection reason if present |
| F-004 | Rejected consultation state includes a clear call to action: seek in-person care, HealthDirect link |
| F-005 | Rejected consultation state confirms a refund has been initiated |
| F-006 | Text chat UI displays a "Finish Consultation" button after the patient has sent at least one message |
| F-007 | Clicking "Finish Consultation" calls the consultation end endpoint and navigates to the result page |
| F-008 | `not-found.tsx` global page renders with Nightingale branding and a "Go to Dashboard" link |
| F-009 | All pages currently using bare text error states are updated to use a shared `<ErrorState>` component |
| F-010 | All result page status branches (`approved`, `amended`, `rejected`, `emergency_escalated`, `cannot_assess`, `resolved`, `unchanged`, `followup_concern`) render meaningful, distinct UI states |

---

## Compliance Notes

**Clinical safety gate:** Issues 1 and 2 are clinical safety issues, not cosmetic bugs. A patient who cannot access an amended response, or who is told to keep waiting after being rejected, may delay appropriate care. These must be fixed before any real patients use the system.

---

## Acceptance Criteria

- [ ] A consultation with `status === "amended"` shows the doctor-amended response text on the result page
- [ ] A consultation with `status === "rejected"` shows the rejection state with reason and in-person care direction
- [ ] A consultation with `status === "rejected"` does not show the "Under Review" spinner
- [ ] Text chat page shows a "Finish Consultation" button after first patient message
- [ ] Navigating to `/consultation/invalid-id/result` renders the branded not-found page, not bare text
- [ ] All 8 consultation status branches render a distinct, appropriate UI state

---

## Dependencies

- PRD-009: Text-Chat Fallback (end button target)
- PRD-013: Doctor Review Dashboard (source of amended/rejected status)
- PRD-020: Patient Web Frontend (design system components)

---

## Out of Scope

- Redesign of the result page (styling changes only as needed to accommodate new states; full redesign is post-beta)
- Push notification for amended/rejected status (handled by PRD-014 email notifications)
