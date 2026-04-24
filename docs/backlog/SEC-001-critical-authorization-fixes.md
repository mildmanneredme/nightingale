# SEC-001 — Critical Authorization Fixes

> **Status:** Not Started
> **Phase:** Security Hardening — Sprint 7
> **Type:** Security — Authorization
> **Priority:** P0 — Must ship before any real patients are onboarded
> **Owner:** CTO
> **Covers audit findings:** SEC-001 (Photo IDOR), SEC-002 (Renewal role guards)

---

## Overview

Two authorization vulnerabilities exist in the current codebase that allow authenticated users to access data and perform actions beyond their permitted scope. Both are pre-beta blockers. Neither requires a schema change — both are single-query or single-middleware fixes.

---

## Background

Authorization in Nightingale uses a layered model: Cognito JWTs establish identity, `requireRole()` middleware enforces role boundaries, and SQL queries enforce row-level ownership. The two issues in this PRD represent breaks in the second and third layers — one where a role check exists but ownership is not verified, and one where the role check itself is absent.

---

## Issue 1 — Photo IDOR: Doctor Can Access Any Patient's Photos

### Description

`GET /api/v1/consultations/:consultationId/photos/:photoId/url` (`api/src/routes/photos.ts`, line 237) checks that the caller holds the `doctor` or `admin` role, but does not verify that the doctor is assigned to the consultation in question. Any authenticated doctor can supply any `consultationId` they know or can guess and receive a valid 15-minute S3 presigned URL for that patient's clinical photos.

### Impact

Clinical photos are among the most sensitive data in the system — they depict intimate areas of the body submitted in a clinical context. A malicious or curious doctor could access another patient's photos without any business justification. The access would generate an audit log entry (the audit log records URL generation), but the system does not actively prevent it. If a consultation ID leaks via a log, a URL, or a support conversation, this becomes a realistic attack vector.

### Proposed Fix

Add an `AND assigned_doctor_id = $doctorId` clause to the photo query. The doctor's database ID must be looked up from their Cognito sub (the same pattern used in `doctor.ts`). For admin callers, the ownership check is bypassed — admins have legitimate cross-consultation access.

```sql
SELECT id, s3_key FROM consultation_photos
WHERE id = $1
  AND consultation_id = $2
  AND (
    SELECT assigned_doctor_id FROM consultations WHERE id = $2
  ) = $doctorId   -- added
```

The lookup of `doctorId` from Cognito sub should be extracted into a shared helper to avoid duplication with `doctor.ts`.

---

## Issue 2 — Renewal Endpoints Missing Explicit Role Guard

### Description

`GET /api/v1/renewals/queue`, `POST /api/v1/renewals/:id/approve`, and `POST /api/v1/renewals/:id/decline` (`api/src/routes/renewals.ts`, lines 141, 180, 240) are mounted behind `requireAuth` (all authenticated users) but have no `requireRole("doctor")` middleware. An authenticated patient can call these endpoints. The doctor-lookup logic inside each handler will return a 404 when no doctor record is found for the patient's sub — so an actual approval or decline is not achievable — but this is defence by obscurity rather than a declared access control boundary.

### Impact

An authenticated patient receives a 404 from a route that should be inaccessible to them, which leaks information about the endpoint's existence and internal structure. More importantly, the security boundary is a side-effect of a database lookup rather than an explicit policy declaration. If the lookup logic ever changes (e.g., to support a future "doctor-patient" hybrid role), the implicit protection disappears silently. The correct pattern is to fail immediately at the middleware layer with a 403 before any database work occurs.

### Proposed Fix

Add `requireRole("doctor")` as inline middleware on the three routes:

```typescript
router.get("/queue", requireRole("doctor"), async (req, res, next) => { ... });
router.post("/:id/approve", requireRole("doctor"), async (req, res, next) => { ... });
router.post("/:id/decline", requireRole("doctor"), async (req, res, next) => { ... });
```

The `expiry-check` endpoint (`POST /expiry-check`) is a scheduler/admin trigger and should have `requireRole("admin")` applied.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Photo presigned URL endpoint verifies the requesting doctor is assigned to the consultation before returning a URL |
| F-002 | Admin callers bypass the doctor-assignment check on photo URLs (admins have legitimate cross-consultation access) |
| F-003 | `GET /api/v1/renewals/queue` returns 403 for any caller without the `doctor` role |
| F-004 | `POST /api/v1/renewals/:id/approve` returns 403 for any caller without the `doctor` role |
| F-005 | `POST /api/v1/renewals/:id/decline` returns 403 for any caller without the `doctor` role |
| F-006 | `POST /api/v1/renewals/expiry-check` returns 403 for any caller without the `admin` role |
| F-007 | All existing doctor and admin renewal tests continue to pass after the role guard is added |
| F-008 | Photo IDOR fix is covered by an integration test: doctor A cannot retrieve a presigned URL for a consultation assigned to doctor B |

---

## Audit Log

No new audit events are introduced. The existing `photo.access_url_generated` event already fires on successful URL generation — after this fix, it will only fire for the assigned doctor or an admin.

---

## Acceptance Criteria

- [ ] Doctor A cannot retrieve a presigned photo URL for a consultation assigned to Doctor B (returns 404)
- [ ] Admin can retrieve a presigned photo URL for any consultation
- [ ] Authenticated patient calling `/api/v1/renewals/queue` receives 403, not 404
- [ ] Authenticated patient calling `/api/v1/renewals/:id/approve` receives 403
- [ ] All existing renewal and photo integration tests pass
- [ ] TypeScript check passes with no errors

---

## Dependencies

- PRD-004: Auth middleware (`requireRole`) — already exists
- PRD-010: Photo upload — route being patched
- PRD-018: Script renewals — routes being patched

---

## Out of Scope

- Row-level security for other endpoints (addressed in future security hardening)
- Changes to the photo upload or listing endpoints
