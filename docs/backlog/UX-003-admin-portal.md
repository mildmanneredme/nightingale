# UX-003 — Admin Portal: Layout, Navigation & Authentication

> **Status:** Not Started
> **Phase:** UX Fixes — Sprint 7
> **Type:** UX — Internal Tooling
> **Priority:** P1 — Required for CTO to monitor beta operations
> **Owner:** CTO
> **Covers audit findings:** UX-004 (No admin layout or auth flow)

---

## Overview

The admin beta dashboard exists as a page (`/admin/beta`) and the admin stats API endpoint is functional, but there is no admin-specific layout, navigation, or frontend authentication routing. An admin user who logs in via the existing auth flow is deposited on the patient dashboard with no path to admin tools. The admin portal needs to be wired end-to-end so that the CTO can monitor the beta in real time.

---

## Background

PRD-016 built the `GET /api/v1/admin/stats` endpoint and a static beta dashboard page. However, the frontend auth system was not extended to handle the `admin` Cognito group, and no `layout.tsx` was created for the `(admin)` route group. This means the admin portal exists in code but is completely unreachable from a browser without manually typing the URL — and even then, the API call will fail because the frontend doesn't provide the correct Bearer token in the admin context.

For beta operations, the CTO needs to be able to:
- Monitor consultation throughput and doctor review rates in real time
- Reassign consultations to different doctors when needed
- Track follow-up response rates
- Identify queue backlogs before they become clinical issues

---

## Functional Requirements

### Authentication & Routing

| # | Requirement |
|---|-------------|
| F-001 | The frontend auth library detects the `admin` Cognito group on login and routes admin users to `/admin/beta` instead of the patient dashboard |
| F-002 | Admin routes (`/admin/*`) are protected: unauthenticated users are redirected to `/login` |
| F-003 | Non-admin authenticated users (patients, doctors) attempting to access `/admin/*` are redirected to their own dashboard |
| F-004 | Admin users navigating to `/` are redirected to `/admin/beta` |

### Layout & Navigation

| # | Requirement |
|---|-------------|
| F-005 | `web/src/app/(admin)/layout.tsx` provides an admin-specific shell with navigation and the admin user's identity visible |
| F-006 | Admin navigation includes: Beta Dashboard, Consultation Management |
| F-007 | Admin layout includes a logout button |
| F-008 | Admin layout is visually distinct from the patient and doctor portals (e.g. a neutral/dark administrative colour scheme rather than the clinical teal) |

### Beta Dashboard Page

| # | Requirement |
|---|-------------|
| F-009 | Beta dashboard fetches stats from `GET /api/v1/admin/stats` using the admin's Bearer token |
| F-010 | Dashboard auto-refreshes every 60 seconds while the tab is visible |
| F-011 | Dashboard shows a "Last updated" timestamp |
| F-012 | Stat cards show a loading skeleton while data is being fetched, not a blank page |
| F-013 | If the stats API returns an error, the dashboard shows an error state with a "Retry" button |

### Consultation Management

| # | Requirement |
|---|-------------|
| F-014 | Admin can view a list of all consultations in `queued_for_review` status with patient name (anonymised to initials), presenting complaint, assigned doctor, and time in queue |
| F-015 | Admin can reassign a consultation to a different doctor via the existing `POST /api/v1/admin/consultations/:id/reassign` endpoint |
| F-016 | Admin sees a visual alert for consultations that have been in the queue for more than 4 hours |

---

## Design Notes

The admin portal is an internal operations tool, not a patient-facing product. It should be functional and clear rather than polished. Priority is information density and ease of action, not brand alignment. A simple two-column layout (sidebar nav + main content) is sufficient.

---

## Acceptance Criteria

- [ ] Logging in as an admin Cognito user routes to `/admin/beta`
- [ ] Logging in as a patient and navigating to `/admin/beta` redirects to patient dashboard
- [ ] Admin dashboard displays stats from the API with the admin's Bearer token
- [ ] Admin dashboard auto-refreshes and shows a "Last updated" timestamp
- [ ] Admin can reassign a consultation to a different doctor from the consultation list
- [ ] Consultations waiting more than 4 hours are visually flagged

---

## Dependencies

- PRD-004: Authentication (Cognito group detection)
- PRD-013: Doctor Review Dashboard (reassignment endpoint)
- PRD-016: Beta Launch Readiness (stats endpoint)

---

## Out of Scope

- Admin management of doctor accounts or patient accounts (separate admin tooling, post-beta)
- Audit log viewer (separate PRD, post-beta)
- Admin impersonation of patient or doctor accounts (post-beta, high security risk)
- Multi-admin user management
