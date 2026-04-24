# SEC-003 — API Hardening: Rate Limiting, Security Headers & Input Validation

> **Status:** Not Started
> **Phase:** Security Hardening — Sprint 7
> **Type:** Security — Defensive Infrastructure
> **Priority:** P0 — Must ship before any real patients are onboarded
> **Owner:** CTO
> **Covers audit findings:** SEC-006 (Rate limiting + Helmet), SEC-009 (Email validation), SEC-010 (Consultation idempotency key)

---

## Overview

The API currently has no rate limiting, no HTTP security headers, and no email format validation. These are foundational defensive measures that any production API serving health data must have. This PRD also addresses consultation idempotency — a gap that is low-risk today but becomes a billing and safety issue the moment payments are enabled (PRD-007).

---

## Background

Rate limiting and security headers are often treated as post-launch concerns. For a telehealth platform handling sensitive clinical data, they are pre-launch requirements. Without them, the API is trivially susceptible to brute-force attacks on authentication, denial-of-service via queue flooding, and clickjacking or content-sniffing attacks in browsers. These are not exotic threats — they are the baseline defence expected of any healthcare software.

---

## Issue 1 — No Rate Limiting

### Description

`api/src/app.ts` has no `express-rate-limit` or equivalent middleware. Every endpoint is unbounded — a caller can make thousands of requests per second with no consequence.

### Impact

- **Brute-force credential attacks:** Cognito has its own throttling, but attackers can interact with the API's auth wrapper directly. A patient with a weak password is vulnerable.
- **Doctor queue flooding:** A patient can create unlimited consultations per minute, overwhelming the doctor queue with spam.
- **S3 storage exhaustion:** 5 photos × 10 MB × unlimited rate = unbounded storage cost.
- **Consultation ID enumeration:** Even with UUIDs, a high-rate scanner against public endpoints gathers intelligence.

### Proposed Fix

Apply layered rate limiting using `express-rate-limit`:

| Tier | Scope | Limit | Window |
|------|-------|-------|--------|
| Global | All endpoints, per IP | 300 requests | 1 minute |
| Consultation creation | `POST /api/v1/consultations` | 5 requests | 1 hour per authenticated patient |
| Photo upload | `POST /api/v1/consultations/:id/photos` | 10 requests | 10 minutes per IP |
| Follow-up respond | `GET /api/v1/followup/respond/:token` | 20 requests | 1 hour per IP |

Rate limit responses must return HTTP 429 with a `Retry-After` header. Limits for the scheduler/admin endpoints (`/followup/send`, `/renewals/expiry-check`) should be set to 60/minute — high enough to never block legitimate scheduler invocations.

---

## Issue 2 — No Security Headers (Helmet)

### Description

The Express API returns no security-oriented HTTP headers. Browsers rely on these headers to enforce policies that prevent a range of client-side attacks.

### Impact

Without security headers:
- **Clickjacking:** The app can be embedded in an iframe on a malicious site, tricking patients into performing actions they didn't intend.
- **MIME sniffing:** Browsers may misinterpret response content types, enabling content-injection attacks.
- **Information disclosure:** The `X-Powered-By: Express` header is sent on every response, revealing the server framework.
- **No HSTS:** Browsers don't know to enforce HTTPS, enabling downgrade attacks on non-secure connections.

### Proposed Fix

Add `helmet()` as the first middleware in `app.ts`. The default Helmet configuration handles: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, removing `X-Powered-By`, and a baseline `Content-Security-Policy`. Configure CSP specifically for this API (JSON responses only — no scripts, styles, or frames needed from the API origin).

---

## Issue 3 — Email Address Not Validated at API

### Description

`POST /api/v1/patients` (registration) and `PATCH /api/v1/patients/me` (profile update) accept any non-empty string as `email` with no format validation. Strings like `test`, `@domain.com`, or `user@` pass the API and are stored.

### Impact

An invalid email means all clinical correspondence — consultation responses, rejection notices, follow-up emails, renewal approvals — silently fails to send. The patient has no indication at registration time that their email is wrong. In a worst case, a patient who enters a typo at registration can never receive their clinical response and has no in-app way to know why.

### Proposed Fix

Add RFC-5322 email format validation using `validator.js` (`isEmail()`) at the API boundary in the patients route. Return a 400 with a clear message ("Invalid email address format") if validation fails. Apply the same check in the profile update endpoint.

---

## Issue 4 — Consultation Creation Has No Idempotency Key

### Description

`POST /api/v1/consultations` has no idempotency mechanism. A double-submit (browser back button, network retry, race condition) creates two separate consultation records for the same patient. This is a UX nuisance today but becomes a financial and clinical issue when PRD-007 (payments) ships — the patient would be charged twice and two consultations would appear in the doctor queue.

### Impact

- **Pre-payments:** Duplicate consultations in history, duplicate doctor queue entries, patient confusion.
- **Post-payments:** Duplicate charge on patient's payment method, potential regulatory exposure (charging twice for the same service), and two consultations awaiting doctor review for the same complaint.

### Proposed Fix

Implement an `Idempotency-Key` header pattern:

1. **Frontend:** Generate a random UUID (`crypto.randomUUID()`) when the patient initiates a consultation. Send it as `Idempotency-Key: <uuid>` on the POST request.
2. **API:** Before inserting a new consultation, check if a consultation with `idempotency_key = $1 AND patient_id = $2` already exists and was created within the last 24 hours. If found, return the existing consultation with 200. If not found, insert the new consultation and store the key.
3. **DB:** Add `idempotency_key TEXT` column to `consultations` with a unique index on `(patient_id, idempotency_key)`.

The 24-hour window prevents stale keys from blocking legitimate re-consultations on the same day while covering all realistic network retry scenarios.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | Global rate limit of 300 req/min per IP applied to all endpoints |
| F-002 | Consultation creation limited to 5 per hour per authenticated patient sub |
| F-003 | Photo upload limited to 10 per 10 minutes per IP |
| F-004 | Rate limit exceeded returns HTTP 429 with `Retry-After` header |
| F-005 | `helmet()` applied as first middleware; all default protections enabled |
| F-006 | CSP configured for API-only (no-script, no-frame) |
| F-007 | `X-Powered-By` header removed from all responses |
| F-008 | Email format validated at patient registration and profile update endpoints |
| F-009 | Invalid email returns HTTP 400 with message "Invalid email address format" |
| F-010 | Consultation creation accepts optional `Idempotency-Key` header |
| F-011 | Duplicate consultation POST within 24 hours returns the existing consultation with HTTP 200 |
| F-012 | Frontend generates and sends an `Idempotency-Key` on every new consultation creation |
| F-013 | `idempotency_key` column added to `consultations` table with unique constraint on `(patient_id, idempotency_key)` |

---

## Compliance Notes

**ASD Essential Eight:** Rate limiting and security headers contribute directly to the Essential Eight Maturity Level 2 requirement (restrict administrative privileges, patch applications) that is required for cyber insurance eligibility.

**OWASP Top 10:** This PRD addresses A04 (Insecure Design — no rate limit), A05 (Security Misconfiguration — no headers), and A03 (Injection — email input validation).

---

## Acceptance Criteria

- [ ] 301st request from the same IP within a minute returns 429
- [ ] A patient attempting to create a 6th consultation in one hour receives 429
- [ ] All responses include `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` headers
- [ ] `X-Powered-By` header absent from all responses
- [ ] Registration with `email = "notanemail"` returns 400
- [ ] Double-POST to consultation creation within 1 minute with same `Idempotency-Key` returns the same consultation ID both times
- [ ] TypeScript check passes

---

## Dependencies

- PRD-003: Infrastructure (Express app baseline)
- PRD-006: Patient registration (email validation target)
- PRD-007: Payments (idempotency key is a blocker for billing)
- PRD-008: AI Voice Consultation (consultation creation endpoint)

---

## Out of Scope

- Per-user authenticated rate limiting (covered by consultation-specific limits above; full per-user rate limiting is Phase 2)
- Idempotency keys for endpoints other than consultation creation
- DDoS protection at the infrastructure level (AWS WAF / Shield — separate infrastructure decision)
