# UX-002 — Patient History & Inbox Improvements

> **Status:** Not Started
> **Phase:** UX Fixes — Sprint 7
> **Type:** UX — Patient Experience
> **Priority:** P1 — High priority; fix before beta patient onboarding
> **Owner:** CTO
> **Covers audit findings:** UX-001 (History no detail view), UX-003 (Inbox not linked to results)

---

## Overview

Two gaps in the patient-facing experience prevent patients from easily accessing their clinical records after a consultation is complete. The history page lists consultations but provides no way to view them. The inbox delivers notifications but provides no path to the full response, PDF, or follow-up content. Together, these mean the app fails to act as a health record — a core promise of the Nightingale product.

---

## Background

A patient's consultation history and inbox are the two primary places they return to after the active consultation flow ends. Both are currently dead ends: the history lists records without linking to them, and the inbox shows notification summaries without connecting them to the underlying content. For a telehealth platform, the ability to review your past clinical assessments, re-download a PDF summary for a pharmacy visit, or track your follow-up response is essential functionality — not a nice-to-have.

---

## Issue 1 — Consultation History Has No Detail View

### Description

`web/src/app/(patient)/history/page.tsx` lists a patient's past consultations with date, status badge, and chief complaint. Tapping any row does nothing — there is no navigation to a detail view. The `GET /api/v1/consultations/:id` endpoint and the result page (`/consultation/[id]/result`) already exist; they are simply not linked from history.

A patient who wants to:
- Re-read their clinical assessment before a GP appointment
- Download a PDF summary to show a pharmacist
- Check the outcome of a past follow-up
- Review their prescription recommendation
…has no way to do so in the app. Their only option is to search their email archive for the original notification.

### Impact

Beyond the obvious usability gap, this creates a clinical risk: patients acting on recalled (and potentially misremembered) medical advice rather than the actual documented assessment. It also undermines trust — a health app that can't show you your own health records is not credible as a long-term health companion.

### Proposed Fix

Link each history row to `/consultation/[id]/result`. For consultations in terminal states (approved, amended, rejected, resolved, unchanged, followup_concern), the result page already renders the appropriate content. For active consultations still in progress (queued_for_review, transcript_ready), the result page renders the "Under Review" state, which is correct.

Additionally, for consultations with `status === "approved"` or `"amended"`, surface a **"Download PDF"** button directly on the history list row (not just inside the result page), so patients can re-download without an extra navigation step.

---

## Issue 2 — Inbox Notifications Not Linked to Results or PDF

### Description

`web/src/app/(patient)/inbox/page.tsx` renders a list of notifications with an unread badge, notification type, and message summary. Selecting a notification shows its body. There is no link from the notification to the consultation result page, and no PDF download button.

For a "response_ready" notification — the most important event in the system — the patient reads "Your consultation response is ready" and has no actionable link. They must close the inbox, navigate to the dashboard, find the consultation, and open it. This is the highest-friction possible path to the highest-value content.

### Impact

Every extra navigation step between a patient reading their notification and accessing their clinical response is a drop-off point. Patients checking the inbox from a mobile browser or a low-engagement context are likely to not complete the journey. Given that the response contains clinical advice they need to act on, incomplete access has real health implications. It also reduces the perceived quality of the product significantly — a notification that tells you something is ready but doesn't let you see it is worse than no notification.

### Proposed Fix

For each inbox notification:

1. **Response Ready / Rejected / Amended:** Add a "View Your Assessment" button that navigates to `/consultation/[notif.consultationId]/result`.
2. **Approved / Amended (PDF available):** Add a secondary "Download PDF" button that calls `GET /api/v1/consultations/:id/pdf`.
3. **Follow-up concern acknowledged:** Add a "View Consultation" link.
4. **Renewal approved/declined:** Add a "View Renewal" link to the renewals page.

The inbox should also display the `consultation.presentingComplaint` as context so the patient can immediately identify which consultation the notification relates to.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Each row in the consultation history page is a clickable link to `/consultation/[id]/result` |
| F-002 | History rows for consultations with status `approved` or `amended` include a "Download PDF" action |
| F-003 | History page shows a meaningful status label for all consultation states (not just "pending" / "complete") |
| F-004 | History page shows the date reviewed (not just the date created) for completed consultations |
| F-005 | Inbox "response_ready" notifications include a "View Your Assessment" button linking to the result page |
| F-006 | Inbox notifications for approved or amended consultations include a "Download PDF" button |
| F-007 | Inbox notification detail displays the `presenting_complaint` as contextual subtitle |
| F-008 | Inbox notifications for renewals link to the renewals page |
| F-009 | "Download PDF" from inbox triggers `GET /api/v1/consultations/:id/pdf` with the patient's Bearer token |
| F-010 | Empty history state renders a prompt to start a new consultation, not a blank page |
| F-011 | Pagination or "load more" for history if the patient has more than 20 consultations |

---

## Acceptance Criteria

- [ ] Clicking a history row navigates to the consultation result page
- [ ] "Download PDF" appears on history rows for approved and amended consultations
- [ ] Inbox "response_ready" notification includes a "View Your Assessment" link
- [ ] Inbox PDF download button fetches and downloads the PDF correctly
- [ ] History page with no consultations renders an empty state with a "Start a Consultation" CTA
- [ ] `presenting_complaint` is shown as subtitle in inbox notification detail

---

## Dependencies

- PRD-015: Post-Consultation Follow-Up (PDF download endpoint)
- PRD-014: Patient Notifications (inbox page being extended)
- PRD-020: Patient Web Frontend (design system)
- UX-001: Consultation Result Display (result page must correctly render all statuses before this PRD links to it)

---

## Out of Scope

- Consultation history search or filtering (Phase 2)
- Sharing a consultation result with another provider (Phase 2)
- Printing directly from the browser (the PDF covers this use case)
