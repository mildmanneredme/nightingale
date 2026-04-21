# PRD-004 — Authentication & Access Control

> **Status:** Not Started
> **Phase:** Sprint 0 (Week 1–2)
> **Type:** Technical — Auth & Security
> **Owner:** CTO

---

## Overview

Implement authentication and role-based access control for three distinct user types: **patients**, **doctors**, and **admins**. Access boundaries between roles are a clinical and legal requirement — doctors must only see consultations assigned to them; patients must only see their own records.

---

## Background

### Open Decision: AWS Cognito vs Auth0

Both are viable. Decision criteria:

| Factor | AWS Cognito | Auth0 |
|--------|-------------|-------|
| Data residency | ap-southeast-2 natively | Runs outside AU by default; AU tenant available |
| Cost at 1k MAU | ~$0 (free tier) | ~$23/month (B2C Essential) |
| MFA support | Yes | Yes |
| Custom UI | Hosted UI (limited) or custom | Flexible |
| HIPAA/healthcare BAA | Yes (standard AWS) | Yes (Enterprise) |
| Complexity | Lower (native AWS IAM integration) | Higher (external service, DPA required) |

**Recommendation:** AWS Cognito for MVP. Lower complexity, native AWS integration, free tier covers Phase 1 volume, data stays in AP-SOUTHEAST-2.

---

## User Roles

### Patient
- Self-registers via web app
- Can only access their own consultations, profile, and uploaded photos
- Cannot see any doctor or admin data
- Anonymous patients supported: no mandatory identity verification, but consultation scope is flagged as restricted

### Doctor (GP)
- Account created by admin only (never self-registration)
- Can only see consultations in their review queue (assigned to them)
- Cannot see other doctors' consultations or any patient records outside of assigned consultations
- AHPRA registration number stored and attached to all approved consultations

### Admin
- Restricted to internal operational use (founder + future ops staff)
- Can create/deactivate doctor accounts
- Can view system-level audit logs
- Cannot view clinical content of individual consultations (operational data only)

---

## Functional Requirements

### Registration & Login

| # | Requirement |
|---|-------------|
| F-001 | Patients can register with email + password |
| F-002 | Email verification required before account activation |
| F-003 | Password requirements: minimum 12 characters, must include upper, lower, number, symbol |
| F-004 | MFA optional for patients, mandatory for doctors and admins |
| F-005 | Doctor accounts created by admin; doctor receives invitation email to set password |
| F-006 | Admin accounts created via CLI/IaC only; never via web UI |
| F-007 | JWT tokens issued on login; short expiry (15 min access token, 7-day refresh token) |
| F-008 | Refresh token rotation: new refresh token issued on each use; old token invalidated |

### Session Management

| # | Requirement |
|---|-------------|
| F-009 | Inactive patient sessions expire after 30 minutes |
| F-010 | Inactive doctor sessions expire after 60 minutes (longer review sessions expected) |
| F-011 | Logout invalidates all active tokens |
| F-012 | Session events (login, logout, failed login) written to audit log |

### Access Control

| # | Requirement |
|---|-------------|
| F-013 | All API routes require authentication; no public data endpoints |
| F-014 | Patient API routes enforce ownership: requests are scoped to the authenticated patient's data |
| F-015 | Doctor API routes enforce assignment: doctors can only read/write consultations in their queue |
| F-016 | Admin routes inaccessible to patient and doctor roles |
| F-017 | Role enforcement at API layer (not just UI) — server-side validation on every request |

### Anonymous Patient Support

| # | Requirement |
|---|-------------|
| F-018 | Anonymous patients can start a consultation without providing name, DOB, or Medicare number |
| F-019 | Anonymous patient accounts require only a valid email (for receiving the doctor's response) |
| F-020 | Anonymous consultation flag stored in database; Clinical AI Engine restricts scope accordingly (PRD-012) |
| F-021 | Anonymous patients cannot link consultations across sessions without identifying themselves |

### Paediatric Support

| # | Requirement |
|---|-------------|
| F-022 | Registration captures date of birth; system flags accounts where patient is under 18 |
| F-023 | Paediatric flag stored in patient profile and propagated to consultation context |
| F-024 | Parent/guardian consent captured at registration for under-18 patients |
| F-025 | Paediatric consultations noted in doctor dashboard; doctor is responsible for assessing appropriateness |

---

## Non-Functional Requirements

- **Data residency:** Auth tokens and user records must remain in ap-southeast-2
- **Audit:** All authentication events logged to the audit log (PRD-005)
- **Brute force protection:** Account lockout after 5 failed login attempts; 15-minute lockout window

---

## Acceptance Criteria

- [ ] Patient can register, verify email, and log in
- [ ] Patient cannot access any other patient's data (verified by test)
- [ ] Doctor account created by admin; doctor logs in with MFA
- [ ] Doctor can only see their own assigned consultations (verified by test)
- [ ] Admin account functions; admin cannot see clinical consultation content (verified by test)
- [ ] Anonymous patient can register with email only and start a consultation with restricted scope flag set
- [ ] Under-18 date of birth triggers paediatric flag in patient profile
- [ ] Auth events appear in audit log within 1 second of event
- [ ] Failed login triggers lockout after 5 attempts

---

## Dependencies

- PRD-003: Infrastructure must be provisioned before auth service can be deployed

---

## Out of Scope

- Single sign-on (SSO) / social login
- Doctor mobile app auth (Phase 2)
- Clinic admin sub-accounts for white-label (Phase 2)
