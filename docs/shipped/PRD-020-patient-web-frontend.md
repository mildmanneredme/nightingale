# PRD-020 — Patient Web Frontend

> **Status:** In progress
> **Phase:** Sprint 2 (concurrent with PRD-008 — patient-facing UI for shipped APIs)
> **Type:** Patient-facing
> **Owner:** CTO

---

## Overview

Build the patient-facing web application that connects to the shipped backend APIs (PRD-006, PRD-008). Patients need a browser UI to register, manage their profile, initiate consultations, participate in the AI voice interview, and view results. This PRD covers the Next.js app only — no doctor-facing screens (deferred to PRD-013).

---

## Background

PRD-006 (patient registration API) and PRD-008 (AI voice consultation API + WebSocket relay) are shipped. Fifteen HTML/Tailwind design mockups exist in `stitch_nightingale_telehealth_interface/`. These mockups define the visual design system: Manrope/Public Sans typography, Material Design 3 colour palette, 12-column bento grid layout. The frontend must implement the patient portal screens faithful to these designs, connected to live APIs.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient (unauthenticated) | Register and login pages only |
| Patient (authenticated) | Dashboard, profile, medical history, consultation flows |
| Doctor / Admin | Not covered by this PRD |

---

## Functional Requirements

### Foundation

| # | Requirement |
|---|-------------|
| F-001 | App runs at `localhost:3000` (dev) and accepts `NEXT_PUBLIC_API_URL` for the backend base URL |
| F-002 | Unauthenticated requests to any `/dashboard`, `/profile`, `/history`, or `/consultation/**` route redirect to `/login` |
| F-003 | Authenticated patients redirected from `/login` and `/register` to `/dashboard` |
| F-004 | App uses the exact design tokens from `clinical_empathy/DESIGN.md`: Manrope headlines, Public Sans body, Material Design 3 palette |

### Registration & Login

| # | Requirement |
|---|-------------|
| F-005 | Patient registers with email + password via Cognito `signUp`; email verification code sent |
| F-006 | Verification code entry screen shown after signup; `confirmSignUp` called on submit |
| F-007 | After verification, `signIn` called automatically, then `POST /api/v1/patients/register` to create backend record |
| F-008 | Privacy Policy and Collection Notice checkbox required before registration proceeds |
| F-009 | Patient logs in with email + password via Cognito `signIn`; Access Token stored in memory |
| F-010 | Login errors (wrong password, unconfirmed account) shown inline with clear messages |
| F-011 | Logout clears token from memory and redirects to `/login` |

### Patient Dashboard

| # | Requirement |
|---|-------------|
| F-012 | Dashboard shows consultation history list from `GET /api/v1/consultations` |
| F-013 | Each consultation row shows: type badge (Voice/Text), status badge, presenting complaint, date |
| F-014 | "Start a Consultation" CTA navigates to `/consultation/new` |
| F-015 | Empty state shown when no consultations exist |

### Patient Profile

| # | Requirement |
|---|-------------|
| F-016 | Profile edit page pre-fills from `GET /api/v1/patients/me` |
| F-017 | Save button calls `PUT /api/v1/patients/me` with changed fields only |
| F-018 | Success/error toast shown after save attempt |

### Medical History

| # | Requirement |
|---|-------------|
| F-019 | Medical history page shows allergies, medications, and conditions from `GET /api/v1/patients/me` |
| F-020 | Patient can add allergy: name + severity (mild/moderate/severe) via `POST /api/v1/patients/me/allergies` |
| F-021 | Patient can delete allergy via `DELETE /api/v1/patients/me/allergies/:id` |
| F-022 | Patient can add/delete medications and conditions (same pattern as allergies) |

### New Consultation

| # | Requirement |
|---|-------------|
| F-023 | New consultation form captures: presenting complaint (textarea) + consultation type (Voice or Text) |
| F-024 | Voice option marked as recommended (matching mockup) |
| F-025 | Submitting calls `POST /api/v1/consultations`; on success redirects to `/consultation/[id]/audio-check` |
| F-026 | Text consultation type creates the record but shows "Text consultation coming soon" screen (PRD-009 not built) |

### Audio Check

| # | Requirement |
|---|-------------|
| F-027 | Audio check page requests microphone permission via `navigator.mediaDevices.getUserMedia` |
| F-028 | Waveform visualiser animates when microphone is active |
| F-029 | "Join Consultation" button navigates to `/consultation/[id]/voice` |
| F-030 | If microphone denied, show error with "Switch to Text Chat" fallback link |

### Voice Consultation

| # | Requirement |
|---|-------------|
| F-031 | Page opens WebSocket to `ws://[host]/api/v1/consultations/[id]/stream` on mount |
| F-032 | Microphone audio (PCM, 16kHz) streamed as `{ type: "audio", data: "<base64>" }` messages |
| F-033 | Incoming `transcript` messages appended to visible conversation feed |
| F-034 | Incoming `audio` messages played back via Web Audio API |
| F-035 | Red flag detected: `emergency` message type shows full-screen red flag banner with 000 reference |
| F-036 | "End Call" button sends `{ type: "end" }`, closes WebSocket, redirects to `/consultation/[id]/result` |
| F-037 | Session timer displayed (elapsed time, updating every second) |
| F-038 | Connection lost: show reconnection error with "End and View Result" fallback |

### Consultation Result

| # | Requirement |
|---|-------------|
| F-039 | Result page fetches consultation via `GET /api/v1/consultations/[id]` |
| F-040 | Status `transcript_ready` or `queued_for_review`: shows "Under Review" state with estimated wait time |
| F-041 | Status `emergency_escalated`: shows emergency escalation screen matching rejected mockup, with 000 prominently |
| F-042 | Status `cannot_assess`: shows "Cannot Assess Remotely" screen matching patient_consultation_result_rejected mockup |
| F-043 | Approved result (future — PRD-012): placeholder screen for when status is `approved` |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Data residency | App served from AWS ap-southeast-2; all API calls to ap-southeast-2 backend |
| Auth | Cognito Access Token in memory only (not localStorage); refresh token handling in scope for PRD-020 |
| Performance | Largest Contentful Paint < 2.5s on 4G (Lighthouse score ≥ 80) |
| Accessibility | WCAG 2.1 AA for all patient-facing screens |
| Security | No patient PII in URL path or query parameters; CSP headers via Next.js config |

---

## Compliance Notes

All patient-facing copy must comply with AHPRA language constraints (see framework Appendix C):
- "assess" not "diagnose"; "recommend" not "prescribe"; "consistent with" not "you have [condition]"
- Emergency screens must reference **000** not 911
- Every screen that references consultation outcomes must include: *"This advice is not a substitute for in-person medical care."*

---

## Acceptance Criteria

- [ ] `npm run dev` starts the app at `localhost:3000` with no errors
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `npm test` — all Vitest unit/component tests pass
- [ ] Unauthenticated visit to `/dashboard` redirects to `/login`
- [ ] Register flow: signup → verify email → backend register → land on `/dashboard`
- [ ] Login flow: credentials → `/dashboard`; bad credentials → inline error
- [ ] Dashboard shows "No consultations yet" when patient has no consultations
- [ ] New consultation form submits and redirects to audio check
- [ ] Audio check: microphone permission request shown; waveform animates on permission grant
- [ ] Voice consultation: WebSocket connects; transcript messages render in conversation feed
- [ ] Emergency message: red flag banner covers screen with 000 reference
- [ ] End call redirects to result page
- [ ] Result page reflects correct status from API

---

## Dependencies

- PRD-004 (Cognito User Pool) — User Pool ID and Client ID required
- PRD-006 (Patient API) — `/api/v1/patients/**` endpoints
- PRD-008 (Consultation API + WebSocket) — `/api/v1/consultations/**` endpoints

---

## Out of Scope

- Doctor portal screens (PRD-013 not built)
- Text consultation UI beyond creation (PRD-009 not built)
- Photo upload (PRD-010 not built)
- Stripe payment gate (PRD-007 deferred)
- Push notifications (PRD-014)
- Native iOS/Android app
- My Health Record sync
