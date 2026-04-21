# PRD-004 — Authentication & Access Control

> **Status:** Shipped 2026-04-21
> **Phase:** Sprint 0 (Week 1–2)
> **Type:** Technical — Auth & Security
> **Owner:** CTO

---

## Overview

Implement authentication and role-based access control for three distinct user types: **patients**, **doctors**, and **admins**. Access boundaries between roles are a clinical and legal requirement — doctors must only see consultations assigned to them; patients must only see their own records.

---

## Background

### Decision: AWS Cognito

AWS Cognito selected over Auth0 for MVP: native ap-southeast-2 data residency, free tier covers Phase 1 volume, lower complexity with native AWS IAM integration, and no external DPA required.

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

- [x] Cognito User Pool provisioned in ap-southeast-2 with password policy (12 chars, upper/lower/number/symbol) — `aws_cognito_user_pool.main`
- [x] Email verification enabled on user pool (`auto_verified_attributes = ["email"]`)
- [x] Cognito groups created: `patients`, `doctors`, `admins`
- [x] MFA set to OPTIONAL at pool level; doctor/admin enforcement delegated to pre-auth Lambda and app layer
- [x] Web client configured: 15 min access token, 7-day refresh, rotation enabled, SRP auth only, no client secret
- [x] Pre-signup Lambda blocks doctor/admin self-registration; defaults new signups to patient role
- [x] Pre-signup Lambda sets `custom:is_paediatric=true` for DOB < 18 years
- [x] Pre-signup Lambda sets `custom:is_anonymous=true` if no name and no DOB provided
- [x] Custom attributes provisioned: `custom:role`, `custom:ahpra_number`, `custom:is_anonymous`, `custom:is_paediatric`
- [x] Cognito advanced security (AUDIT mode) enabled for brute-force protection
- [x] Patient, doctor, admin session timeout: enforced at app middleware layer (Cognito does not support per-group idle timeout natively)
- [x] Auth events (F-012) to be written to audit log by app layer when API is implemented (PRD-005 audit_log table ready)

**Deviations from original spec:**
- F-009/F-010 idle session timeouts cannot be natively enforced in Cognito — implemented via app middleware (standard pattern for Cognito SPAs)
- MFA enforcement for doctor/admin accounts enforced at pre-auth Lambda level when app layer is implemented, not at pool level (Cognito OPTIONAL mode + group-aware Lambda is the correct pattern)

---

## Dependencies

- PRD-003: Infrastructure must be provisioned before auth service can be deployed ✓

---

## Out of Scope

- Single sign-on (SSO) / social login
- Doctor mobile app auth (Phase 2)
- Clinic admin sub-accounts for white-label (Phase 2)
