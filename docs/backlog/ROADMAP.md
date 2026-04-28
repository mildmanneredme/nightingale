# Project Nightingale — Master Roadmap

> **Status:** In Progress — Sprint 10 (Doctor Onboarding, Payments, Photo AI Vision, Clinical Quality)
> **Phase:** 1 MVP (Months 1–6)
> **Target:** 100 beta patients, 200 consultations completed
> **Last updated:** 2026-04-28 (PRD-029/030/031/032 shipped — voice auto-disconnect, clinical knowledge expansion, LLM benchmarking, semantic RAG)

---

## What We're Building

An AI-first human-in-the-loop (HITL) telehealth platform. Patients conduct a structured clinical interview with an AI voice agent, upload photos if relevant, and receive a doctor-reviewed assessment within hours — all for ~$50 AUD per consultation.

**Critical invariant:** No AI output reaches a patient without a credentialed GP reviewing and approving it.

---

## PRD Index

| PRD | Title | Phase | Sprint | Timeline | Status |
|-----|-------|-------|--------|----------|--------|
| [PREREQ-001](PREREQ-001-regulatory-legal-prerequisites.md) | Regulatory & Legal Prerequisites | Pre-build | — | Before Week 1 | Not started |
| [RESEARCH-002](../research/archive/2026-04-21-llm-voice-platform-evaluation.md) | LLM & Voice Platform Evaluation | Pre-build | — | Weeks 1–5 (concurrent) | **Complete — archived** ✅ |
| [PRD-003](../shipped/PRD-003-infrastructure-devops.md) | Infrastructure & DevOps | Build | Sprint 0 | Week 1–2 | **Shipped 2026-04-22** ✅ |
| [PRD-004](../shipped/PRD-004-authentication-access-control.md) | Authentication & Access Control | Build | Sprint 0 | Week 1–2 | **Shipped 2026-04-21** ✅ |
| [PRD-005](../shipped/PRD-005-audit-log.md) | Audit Log & Compliance Infrastructure | Build | Sprint 0 | Week 1–2 | **Shipped 2026-04-21** ✅ |
| [PRD-006](../shipped/PRD-006-patient-registration.md) | Patient Registration & Profile | Build | Sprint 1 | Week 3–4 | **Shipped 2026-04-23** ✅ |
| [PRD-007](PRD-007-payments-booking.md) | Payments & Consultation Booking | Build | Pre-beta | Deferred | **Deferred — not required for MVP functional testing** |
| [PRD-008](../shipped/PRD-008-ai-voice-consultation.md) | AI Voice Consultation | Build | Sprint 2 | Week 5–7 | **Shipped 2026-04-23** ✅ |
| [PRD-009](../shipped/PRD-009-text-chat-fallback.md) | Text-Chat Fallback | Build | Sprint 2 | Week 5–7 | **Shipped 2026-04-23** ✅ |
| [PRD-010](../shipped/PRD-010-photo-upload.md) | Photo Upload & Quality Guidance | Build | Sprint 3 | Week 7–8 | **Shipped 2026-04-24** ✅ |
| [PRD-011](../shipped/PRD-011-clinical-knowledge-base.md) | Clinical Knowledge Base & RAG Pipeline | Build | Sprint 3 | Week 7–8 | **Shipped 2026-04-23** ✅ |
| [PRD-012](../shipped/PRD-012-clinical-ai-engine.md) | Clinical AI Engine | Build | Sprint 4 | Week 8–10 | **Shipped 2026-04-24** ✅ |
| [PRD-013](../shipped/PRD-013-doctor-review-dashboard.md) | Doctor Review Dashboard | Build | Sprint 5 | Week 10–12 | **Shipped 2026-04-23** ✅ |
| [PRD-014](../shipped/PRD-014-patient-notifications.md) | Patient Notifications | Build | Sprint 5 | Week 10–12 | **Shipped 2026-04-24** ✅ |
| [PRD-015](../shipped/PRD-015-post-consultation-followup.md) | Post-Consultation Follow-Up | Build | Sprint 6 | Week 12–14 | **Shipped 2026-04-23** ✅ |
| [PRD-016](../shipped/PRD-016-beta-launch-readiness.md) | Beta Launch Readiness | Build | Sprint 6 | Week 12–14 | **Shipped 2026-04-23** ✅ |
| [PRD-017](../shipped/PRD-017-doctor-scheduling-availability.md) | Doctor Scheduling & Availability | Build | Sprint 5 | Week 10–12 | **Shipped 2026-04-24** ✅ |
| [PRD-018](../shipped/PRD-018-script-renewals.md) | Script Renewal Workflow | Build | Sprint 5 | Week 10–12 | **Shipped 2026-04-24** ✅ |

| [PRD-019](PRD-019-clinical-knowledge-base-proprietary.md) | Clinical Knowledge Base: Proprietary Extensions (eTG, AMH, MIMS) | Phase 2 | Post-Beta | After PRD-021 stable | Not started |
| [PRD-020](../shipped/PRD-020-patient-web-frontend.md) | Patient Web Frontend | Build | Sprint 2 | Week 5–7 | **Shipped 2026-04-23** ✅ |
| [PRD-021](../shipped/PRD-021-clinical-knowledge-expansion.md) | Clinical Knowledge Base Expansion — ~143 Additional GP Presentations | Phase 2 | Sprint 8 | After PRD-011 stable | **Shipped 2026-04-25** ✅ (ingest + MD sign-off pending) |
| [PRD-022](../shipped/PRD-022-public-marketing-site.md) | Public Marketing Site & Legal Pages | Build | Sprint 8 | Week 17–18 | **Shipped 2026-04-25** ✅ |
| [PRD-016-UI](../shipped/PRD-016-ui-redesign.md) | UI Redesign: Implement Stitch Mockups | Build | Sprint 8 | Week 17–18 | **Shipped 2026-04-25** ✅ |
| — | — | — | — | — | — |
| **SEC-001** | [Critical Authorization Fixes](../shipped/SEC-001-critical-authorization-fixes.md) | Security Hardening | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **SEC-002** | [Email & Webhook Security](../shipped/SEC-002-email-webhook-security.md) | Security Hardening | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **SEC-003** | [API Hardening: Rate Limiting, Headers & Validation](../shipped/SEC-003-api-hardening.md) | Security Hardening | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **SEC-004** | [Session & Token Security](../shipped/SEC-004-session-token-security.md) | Security Hardening | Sprint 7 | Week 15–16 | **Shipped 2026-04-24** ✅ |
| **SEC-005** | [Renewal Business Logic Integrity](../shipped/SEC-005-renewal-integrity.md) | Security Hardening | Sprint 7 | Week 15–16 | **Shipped 2026-04-24** ✅ |
| **UX-001** | [Consultation Result & State Display](../shipped/UX-001-consultation-result-display.md) | UX Fixes | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **UX-002** | [Patient History & Inbox Improvements](../shipped/UX-002-patient-history-inbox.md) | UX Fixes | Sprint 7 | Week 15–16 | **Shipped 2026-04-24** ✅ |
| **UX-003** | [Admin Portal: Layout, Navigation & Auth](../shipped/UX-003-admin-portal.md) | UX Fixes | Sprint 7 | Week 15–16 | **Shipped 2026-04-24** ✅ |
| **UX-004** | [Patient Profile Completeness](../shipped/UX-004-patient-profile-completeness.md) | UX Fixes | Sprint 7 | Week 16 | **Shipped 2026-04-24** ✅ |
| **OPS-001** | [Comprehensive Error Logging & Observability](../shipped/OPS-001-error-logging-observability.md) | Operational | Sprint 8 | Week 17–18 | **Shipped 2026-04-25** ✅ |
| **BUG-001** | [Auth & Navigation Hardening](../shipped/BUG-001-auth-navigation-hardening.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ |
| **BUG-002** | [Legal Pages: Privacy Policy & Collection Notice](../shipped/BUG-002-legal-pages.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ (via PRD-022) |
| **BUG-003** | [Forgot Password Flow](../shipped/BUG-003-forgot-password.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ |
| **BUG-004** | [API Client Constructs Absolute localhost URLs](../shipped/BUG-004-api-client-localhost-url.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ |
| **BUG-005** | [Cognito Login 400 / Silent Failure](../shipped/BUG-005-cognito-login-400.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ |
| **BUG-006** | [Staging Deployment Failures: Consultation Broken End-to-End](../shipped/BUG-006-staging-deployment-failures.md) | Bug Fix | Sprint 8 | Week 17 | **Shipped 2026-04-25** ✅ |
| — | — | — | — | — | — |
| **QA-001** | [Playwright End-to-End Test Suite](QA-001-playwright-e2e-suite.md) | Quality Assurance | Periodic / on-request | Not in per-PR CI | Not started |
| — | — | — | — | — | — |
| **BUG-007** | [Remove Placeholder & Fake Content from Patient Surfaces](../shipped/BUG-007-remove-placeholder-content.md) | Bug Fix | Onboarding | P0 — pre-beta credibility | **Shipped 2026-04-26** ✅ |
| **PRD-023** | [Patient Onboarding & Clinical Baseline](../shipped/PRD-023-patient-onboarding-clinical-baseline.md) | Build — Patient Experience | Onboarding | P1 — pre-beta clinical safety | **Shipped 2026-04-26** ✅ |
| **PRD-024** | [Family Accounts & Multi-Patient Profiles](PRD-024-family-accounts-multi-patient-profiles.md) | Build — Identity + Compliance | Phase 2 (post-beta) | P2 — all decisions + clarifications resolved 2026-04-26 | Ready for sprint planning |
| **UX-005** | [Auth Flow Polish](../shipped/UX-005-auth-flow-polish.md) | UX Fixes | Onboarding | P2 — before scaling beyond pilot | **Shipped 2026-04-26** ✅ |
| **PRD-025** | [Doctor Onboarding & Admin Verification](../shipped/PRD-025-doctor-onboarding-verification.md) | Build — Doctor Onboarding | Sprint 10 | P1 — pre-beta; self-serve doctor pipeline required before scaling | In progress |
| **PRD-026** | [Photo AI Vision Analysis](PRD-026-photo-ai-vision-analysis.md) | Build — AI / Clinical | Sprint 10 | P1 — pre-beta clinical quality; skin conditions require photo analysis | Not started |
| **PRD-027** | [SMS Notifications](PRD-027-sms-notifications.md) | Build — Notifications | Phase 2 | P2 — before scaling beyond beta cohort | Not started |
| **PRD-028** | [eScript Integration](PRD-028-escript-integration.md) | Build — Clinical / Prescribing | Phase 2 (post-beta) | P3 — significant clinical value; requires eScript platform API agreement | Not started |
| **PRD-029** | [Voice Agent Auto-Disconnect & Real-Time Session Notes](../shipped/PRD-029-voice-auto-disconnect-session-notes.md) | Build — Voice / UX | Sprint 10 | P1 — clinical UX quality; patients confused about when interview ends | **Shipped 2026-04-28** ✅ |
| **PRD-030** | [Clinical Knowledge Base — Open-Source Expansion Round 2](../shipped/PRD-030-clinical-knowledge-expansion-round2.md) | Build — Clinical Knowledge | Sprint 10 | P1 — improve AI grounding with additional free AU clinical sources | **Shipped 2026-04-28** ✅ |
| **PRD-031** | [LLM Model Benchmarking Framework](../shipped/PRD-031-llm-benchmarking-framework.md) | Build — AI / Quality | Sprint 10 | P2 — validate current Claude Sonnet 4.6 choice; identify cost/quality trade-offs | **Shipped 2026-04-28** ✅ |
| **PRD-032** | [Semantic RAG Pipeline (Vector Embeddings)](../shipped/PRD-032-semantic-rag-pipeline.md) | Build — AI / Clinical | Sprint 10 | P1 — replace broken keyword search with Bedrock Titan cosine similarity; activate knowledge base contribution | **Shipped 2026-04-28** ✅ |

---

## Shipped

| PRD | Title | Shipped | Notes |
|-----|-------|---------|-------|
| [PRD-003](../shipped/PRD-003-infrastructure-devops.md) | Infrastructure & DevOps | 2026-04-22 | TLS 1.3 pending domain + ACM cert; RDS on `db.t3.micro` pending account upgrade |
| [PRD-004](../shipped/PRD-004-authentication-access-control.md) | Authentication & Access Control | 2026-04-21 | MFA enforcement for doctor/admin at app middleware layer; idle timeout via app middleware (Cognito limitation) |
| [PRD-005](../shipped/PRD-005-audit-log.md) | Audit Log & Compliance Infrastructure | 2026-04-21 | DB migration pending (RDS in private subnet — requires ECS task or bastion); admin log viewer and gap alerting are app-layer work |
| [PRD-006](../shipped/PRD-006-patient-registration.md) | Patient Registration & Profile | 2026-04-23 | IHI field as free-text only (no HI Service lookup); full address captured; paediatric guardian fields included |
| [PRD-008](../shipped/PRD-008-ai-voice-consultation.md) | AI Voice Consultation | 2026-04-23 | Backend only (no browser client); question trees are placeholder system prompt (Medical Director content is PRD-011); audio sample recording (F-010a) deferred; WS auth token validation deferred to follow-up PR |
| [PRD-009](../shipped/PRD-009-text-chat-fallback.md) | Text-Chat Fallback | 2026-04-23 | Gemini 3 Flash chat with context injection; supports question/complete/emergency response types; 8 Jest tests green; `POST /api/v1/consultations/:id/chat` endpoint |
| [PRD-011](../shipped/PRD-011-clinical-knowledge-base.md) | Clinical Knowledge Base & RAG Pipeline | 2026-04-23 | ILIKE text search (pgvector fallback); SNOMED normalisation; audit log on retrieval; 14 Jest tests green; ingestion script for markdown knowledge chunks; 5 GP presentation scaffolds (URTI, UTI, skin rash, MSK, mental health) |
| [PRD-013](../shipped/PRD-013-doctor-review-dashboard.md) | Doctor Review Dashboard | 2026-04-23 | Backend: queue/detail/approve/amend/reject endpoints + admin reassign + AHPRA audit log; 10 Jest tests green; Frontend: Next.js doctor portal with queue page, consultation detail, amend side-by-side editor, reject form |
| [PRD-010](../shipped/PRD-010-photo-upload.md) | Photo Upload & Quality Guidance | 2026-04-24 | 9 Jest tests green (S3 mocked); client-side quality checks via canvas (resolution, luminance, Laplacian blur); EXIF strip + HEIC→JPEG via sharp; SSE-KMS S3 upload; 15-min pre-signed URLs; upload progress bar (F-016) deferred |
| [PRD-012](../shipped/PRD-012-clinical-ai-engine.md) | Clinical AI Engine | 2026-04-24 | 20 PII unit tests + 13 engine integration tests green (Anthropic client mocked); Claude Sonnet 4.6 via Bedrock or direct API; prompt caching on system prompt; deterministic flags; cannot-assess triage; photo vision analysis deferred; pre-production gates pending Medical Director sign-off |
| [PRD-020](../shipped/PRD-020-patient-web-frontend.md) | Patient Web Frontend | 2026-04-23 | 54 Vitest tests green; 10 Next.js routes; real Cognito auth; Tailwind design system matching clinical_empathy mockups; text chat UI added; E2E Playwright deferred pending Cognito test user setup |
| [PRD-014](../shipped/PRD-014-patient-notifications.md) | Patient Notifications | 2026-04-24 | 11 Jest integration tests green (SendGrid mocked); response_ready + rejected email templates; SendGrid webhook handler; patient inbox page with unread badge; fire-and-forget from doctor approve/amend/reject; SMS deferred |
| [PRD-017](../shipped/PRD-017-doctor-scheduling-availability.md) | Doctor Scheduling & Availability | 2026-04-24 | 10 Jest integration tests green; weekly schedule CRUD; date overrides; daily cap; monthly capacity widget; patient response-time estimate endpoint; audit log events; AEST timezone via Intl |
| [PRD-018](../shipped/PRD-018-script-renewals.md) | Script Renewal Workflow | 2026-04-24 | 11 Jest integration tests green (SendGrid mocked); patient submit/list; doctor queue; approve/decline with AHPRA audit; 48h expiry alert + 7-day reminder; legal mechanism pre-prod gate pending |
| [PRD-015](../shipped/PRD-015-post-consultation-followup.md) | Post-Consultation Follow-Up | 2026-04-23 | 9 integration tests written (DB-required); follow-up email + 3-button tracking URLs; better/same/worse response handling; FOLLOWUP_CONCERN flag + doctor re-queue; patient acknowledgement email; PDF summary endpoint (pdfkit, AHPRA footer); confirmation page; `scheduleFollowUp` wired to approve/amend; 72h no-response mark + EventBridge trigger deferred |
| [PRD-016](../shipped/PRD-016-beta-launch-readiness.md) | Beta Launch Readiness | 2026-04-23 | Technical implementation only: `GET /api/v1/admin/stats` (patient/consult counts, approval rates, follow-up outcomes); beta dashboard page; 2 admin integration tests; compliance/operational gates remain (pen test, DPAs, TGA, AHPRA, Medical Director sign-offs) |
| [SEC-001](../shipped/SEC-001-critical-authorization-fixes.md) | Critical Authorization Fixes | 2026-04-24 | Photo IDOR fixed: SQL JOIN verifies `assigned_doctor_id` + admin bypass via `cognito:groups`; renewal role guards added: `requireRole("doctor")` on queue/approve/decline, `requireRole("admin")` on expiry-check; TypeScript clean; TDD tests written |
| [SEC-002](../shipped/SEC-002-email-webhook-security.md) | Email & Webhook Security | 2026-04-24 | SendGrid webhook ECDSA signature verification (`@sendgrid/eventwebhook`); raw body parsing for webhook route; fail-closed if `SENDGRID_WEBHOOK_PUBLIC_KEY` unset; HTML injection escaping (`he`) on rejection message, renewal approval/decline reviewNote; 12 unit tests green |
| [SEC-003](../shipped/SEC-003-api-hardening.md) | API Hardening: Rate Limiting, Headers & Validation | 2026-04-24 | `helmet()` with strict CSP; global 300 req/min rate limit; RFC-5322 email validation on patient registration; consultation idempotency key (header + DB column + 24h dedup); migration 012 added; 8 unit tests green |
| [SEC-004](../shipped/SEC-004-session-token-security.md) | Session & Token Security | 2026-04-24 | WS stream-token endpoint: single-use UUID, 2-min TTL, stored in ws_tokens; upgrade handler validates + marks used; follow-up audit log stores SHA-256 token hash (not raw token); migration 013 for ws_tokens table; 5 tests green |
| [SEC-005](../shipped/SEC-005-renewal-integrity.md) | Renewal Business Logic Integrity | 2026-04-24 | `noPriorPrescriptionWarning` flag in doctor queue when no source consultation; `validDays` max enforcement (default 90, overridable via `RENEWAL_MAX_VALID_DAYS`); audit metadata includes `valid_days` + `max_valid_days`; 5 unit tests green |
| [UX-001](../shipped/UX-001-consultation-result-display.md) | Consultation Result & State Display | 2026-04-24 | Amended status renders `doctor_draft`; rejected status renders rejection reason + in-person care direction + refund notice; 8 status branches covered; "Finish Consultation" button in text chat; `not-found.tsx` global page; `<ErrorState>` component; API now returns `doctorDraft` + `rejectionMessage`; TypeScript clean both API + web |
| [UX-002](../shipped/UX-002-patient-history-inbox.md) | Patient History & Inbox Improvements | 2026-04-24 | Dashboard: full STATUS_LABELS/COLORS for all 11 statuses; PDF download button for approved/amended; empty state with branded CTA; Inbox: "View Your Assessment" link for response_ready/rejected; "Download PDF Summary" for approved/amended; expanded TYPE_LABELS; TypeScript clean |
| [UX-003](../shipped/UX-003-admin-portal.md) | Admin Portal: Layout, Navigation & Auth | 2026-04-24 | `getUserRole()` decodes Cognito JWT groups; login routes admin→/admin/beta, doctor→/doctor/queue, patient→/dashboard; `(admin)/layout.tsx` auth+role guard + dark sidebar nav + logout; beta dashboard uses `getAdminStats()` via Bearer token, 60s auto-refresh, last-updated timestamp, loading skeleton, retry on error; `/admin/consultations` queue page with 4h alert + inline reassign dropdown; 7 unit tests green; TypeScript clean |
| [UX-004](../shipped/UX-004-patient-profile-completeness.md) | Patient Profile Completeness | 2026-04-24 | Guardian section (name, email, relationship) visible only for paediatric accounts (`isPaediatric === true`); pre-populated from DB; saves via existing PUT /patients/me; shows "Guardian details updated" confirmation; email displayed as read-only with support note; API GET /me + PUT /me extended to return/accept guardian fields; 4 unit tests green; TypeScript clean |
| [PRD-022](../shipped/PRD-022-public-marketing-site.md) | Public Marketing Site & Legal Pages | 2026-04-25 | 10 marketing pages in `(marketing)` route group; `MarketingNav` (hamburger mobile drawer) + `MarketingFooter` (4-col, 000 emergency strip); Home, How It Works, Pricing, Safety, FAQ, For Doctors, About, Privacy, Terms, Disclaimer; AHPRA language compliant; design system aligned (border-radius tokens, typography tokens, shadow-card, BottomNavBar tint, TopAppBar logo); TypeScript clean; resolves BUG-002 (legal pages) |
| [PRD-016-UI](../shipped/PRD-016-ui-redesign.md) | UI Redesign: Implement Stitch Mockups | 2026-04-25 | DS-001/DS-002: Manrope + Public Sans + Material Symbols fonts loaded in layout, Tailwind font aliases wired; SC-001–SC-004: TopAppBar, BottomNavBar, DoctorSideNav, StatusBadge + ConsultationStepper, Toast, ToastProvider; full page rewrites for login, register, dashboard, new consultation, voice/text consultation, photo upload, result, history, profile, doctor queue and review pages; responsive at 375px and 1280px |
| [PRD-021](../shipped/PRD-021-clinical-knowledge-expansion.md) | Clinical Knowledge Base Expansion | 2026-04-25 | ~143 RACGP condition files across all major GP presentation categories (cardiovascular, respiratory, GI, MSK, neuro, dermatology, women's/men's health, paediatric, geriatric, mental health, infectious disease, oncology, travel medicine); 3 PRD-011 gap stubs (PBS overview, MBS telehealth items, Red Book preventive screening); ingest verification + Medical Director PR approval pending before production ingest |
| [OPS-001](../shipped/OPS-001-error-logging-observability.md) | Comprehensive Error Logging & Observability | 2026-04-25 | Correlation IDs on all requests; structured error logging; client-side error reporting endpoint (`POST /api/v1/client-error`); `<ErrorState>` component; error propagation through API client |
| [BUG-001](../shipped/BUG-001-auth-navigation-hardening.md) | Auth & Navigation Hardening | 2026-04-25 | `mapCognitoError()` in auth.ts covers all Cognito error codes; root 404 resolved via PRD-022 marketing homepage; `getPool()` guard throws dev-friendly error when env vars missing; register + verify error paths cleaned up |
| [BUG-002](../shipped/BUG-002-legal-pages.md) | Legal Pages | 2026-04-25 | Resolved via PRD-022 — Privacy at `/privacy`, Terms at `/terms`, Disclaimer at `/disclaimer` |
| [BUG-003](../shipped/BUG-003-forgot-password.md) | Forgot Password Flow | 2026-04-25 | Two-step `/forgot-password` page; `forgotPassword` + `confirmForgotPassword` added to auth.ts; "Forgot password?" link on login page; all Cognito error codes mapped to friendly copy |
| [BUG-004](../shipped/BUG-004-api-client-localhost-url.md) | API Client localhost URL | 2026-04-25 | `api.ts` rewritten to use relative paths throughout; `NEXT_PUBLIC_API_URL` removed from browser code; Next.js rewrite proxy handles API routing in all environments; `api.test.ts` updated |
| [BUG-005](../shipped/BUG-005-cognito-login-400.md) | Cognito Login 400 / Silent Failure | 2026-04-25 | `getPool()` guard for missing env vars; `mapCognitoError()` centralised in auth.ts; login page renders inline error messages for all Cognito failure modes |
| [BUG-006](../shipped/BUG-006-staging-deployment-failures.md) | Staging Deployment Failures | 2026-04-25 | End-to-end consultation flow restored on staging |
| [BUG-007](../shipped/BUG-007-remove-placeholder-content.md) | Remove Placeholder & Fake Content | 2026-04-26 | Fake vitals, hardcoded 85% completeness, broken legal links removed from all patient surfaces |
| [PRD-023](../shipped/PRD-023-patient-onboarding-clinical-baseline.md) | Patient Onboarding & Clinical Baseline | 2026-04-26 | 3-step onboarding wizard; clinical baseline (allergies/medications/conditions); profile completeness; AI pre-context; doctor queue warnings; DB migration 016 |
| [UX-005](../shipped/UX-005-auth-flow-polish.md) | Auth Flow Polish | 2026-04-26 | Live password checklist (12-char Cognito policy); resend code with 60s cooldown; "Use a different email" flow; fee messaging unified |
| [PRD-029](../shipped/PRD-029-voice-auto-disconnect-session-notes.md) | Voice Agent Auto-Disconnect & Real-Time Session Notes | 2026-04-28 | Completion trigger phrase detected in AI output transcription; 3.5s grace period; real-time note extraction (symptoms, duration, severity, meds, allergies, conditions) sent as `session_notes` WS messages; collapsible notes panel in voice UI |
| [PRD-030](../shipped/PRD-030-clinical-knowledge-expansion-round2.md) | Clinical Knowledge Base — Open-Source Expansion Round 2 | 2026-04-28 | Research + ingestion scripts for 8 additional free AU clinical sources; Healthdirect, ACSQHC, RACGP Red Book extensions, NHMRC obesity/diabetes guidelines, AMH open chapters, Cochrane AU summaries, TGA alerts, DermNet NZ |
| [PRD-031](../shipped/PRD-031-llm-benchmarking-framework.md) | LLM Model Benchmarking Framework | 2026-04-28 | 20 synthetic AU GP consultation transcripts; evaluation harness for Claude Sonnet 4.6 / Haiku 4.5 / GPT-4o / GPT-4o-mini / Gemini 1.5 Pro / Flash; scoring on SOAP completeness, AHPRA compliance, clinical accuracy, latency, cost |
| [PRD-032](../shipped/PRD-032-semantic-rag-pipeline.md) | Semantic RAG Pipeline (Vector Embeddings) | 2026-04-28 | Bedrock Titan Embed Text V2 (ap-southeast-2); pgvector migration 019; cosine similarity ≥0.5 threshold; keyword fallback; backfill script; benchmark --rag-comparison flag; `retrieval_method` audit field |

---

## Timeline Overview

```
PRE-BUILD          SPRINT 0       SPRINT 1       SPRINT 2       SPRINT 3       SPRINT 4       SPRINT 5       SPRINT 6       SPRINT 7
(Before Week 1)    (Week 1–2)     (Week 3–4)     (Week 5–7)     (Week 7–8)     (Week 8–10)    (Week 10–12)   (Week 12–14)   (Week 14–16)

PRD-001            PRD-003        PRD-006        PRD-008        PRD-010        PRD-012        PRD-013        PRD-015        SEC-001 ⚠
Regulatory &       Infrastructure Patient        AI Voice       Photo Upload   Clinical AI    Doctor Review  Post-Consult   Critical Auth
Legal Prereqs      & DevOps       Registration   Consultation   & Quality      Engine         Dashboard      Follow-Up      Fixes

PRD-002 *          PRD-004        —              PRD-009        PRD-011                       PRD-014        PRD-016        SEC-002 ⚠
LLM & Voice        Auth &         (PRD-007       Text-Chat      Clinical                      Patient        Beta Launch    Email/Webhook
Evaluation         Access         deferred —     Fallback       Knowledge                     Notifications  Readiness      Security
(ongoing Wk 1–5)                 pre-beta)                     Base & RAG
                                                                                                                            SEC-003 ⚠
                   PRD-005                                                                    PRD-017        PRD-018        API Hardening
                   Audit Log                                                                  Doctor Sched   Script         (rate limiting,
                                                                                              & Avail.       Renewals       helmet, validation)

                                                                                                                            UX-001 ⚠
                                                                                                                            Result Page
                                                                                                                            Fixes

                                                                                                                            SEC-004
                                                                                                                            Session Tokens

                                                                                                                            SEC-005
                                                                                                                            Renewal Logic

                                                                                                                            UX-002
                                                                                                                            History & Inbox

                                                                                                                            UX-003
                                                                                                                            Admin Portal

                                                                                                                            UX-004
                                                                                                                            Profile (P2)
```

⚠ = P0 pre-beta blocker. Must ship before first real patient consultation.

*PRD-002 runs concurrently from Week 1; voice platform decision gates Sprint 2 start; LLM decision gates Sprint 4 start.

---

## Sprint 7 — Security Hardening & UX Fixes (Week 14–16)

Sprint 7 was scoped following a full security and user journey audit conducted 2026-04-24. The audit identified 12 security vulnerabilities and 7 UX gaps across the codebase. The findings were grouped into 9 PRDs spanning two priority tiers.

### P0 Pre-Beta Blockers (must ship before first real patient)

| PRD | Issue | Why It's a Blocker |
|-----|-------|-------------------|
| [SEC-001](SEC-001-critical-authorization-fixes.md) | Photo IDOR + renewal role guards | Any authenticated doctor can access any patient's clinical photos; patients can probe doctor-only endpoints |
| [SEC-002](SEC-002-email-webhook-security.md) | Webhook signature + HTML injection in emails | Fake delivery events corruptible; doctor can inject HTML into patient clinical emails |
| [SEC-003](SEC-003-api-hardening.md) | Rate limiting + helmet + email validation | No brute-force protection, no security headers, invalid emails silently block all notifications |
| [UX-001](UX-001-consultation-result-display.md) | Amended/rejected result display + text end button | Patients with amended responses never see them; rejected patients see "still waiting"; text chat has no exit |

### P1 High Priority (fix before scaling beyond beta cohort)

| PRD | Issue |
|-----|-------|
| [SEC-004](SEC-004-session-token-security.md) | WebSocket stream uses consultation ID as session credential; follow-up token in audit log |
| [SEC-005](SEC-005-renewal-integrity.md) | Renewals accepted without prior prescription link; no maximum valid period enforced |
| [UX-002](UX-002-patient-history-inbox.md) | History has no detail view; inbox doesn't link to results or PDF |
| [UX-003](UX-003-admin-portal.md) | Admin portal unreachable — no layout, nav, or auth routing |

### P2 Before Paediatric Consultations

| PRD | Issue |
|-----|-------|
| [UX-004](UX-004-patient-profile-completeness.md) | Guardian fields not editable on profile page — required before paediatric consults are enabled |

---

## Sprint 10 — Doctor Onboarding, Payments & Photo AI Vision

Sprint 10 is the final pre-beta sprint. It ships the three remaining blockers before any real patient can be onboarded, plus the photo AI vision gap identified in the 2026-04-27 product audit.

### P0 Pre-Beta Blockers (must ship before first real patient)

| PRD | Issue | Why It's a Blocker |
|-----|-------|-------------------|
| [PRD-007](PRD-007-payments-booking.md) | Stripe payment integration | No payment gate exists; consultations cannot be billed; the consultation state machine (unpaid → paid → in_progress) is not enforced |
| [PRD-025](../shipped/PRD-025-doctor-onboarding-verification.md) | Doctor self-serve application + admin verification | Currently doctor accounts are admin-created out-of-band; no self-serve pipeline; approved doctor gating on action endpoints not enforced |
| [PREREQ-001](PREREQ-001-regulatory-legal-prerequisites.md) | Regulatory & legal prerequisites | TGA SaMD advice, Medical Director agreement, DPAs with all vendors, and clinical governance framework are all unresolved — none of these are code, but all gate legal operation |

### P1 Pre-Beta Clinical Quality

| PRD | Issue | Why It Matters |
|-----|-------|---------------|
| [PRD-026](PRD-026-photo-ai-vision-analysis.md) | Photo AI vision analysis | Clinical AI engine generates SOAP note and differential from transcript only — photos are never passed to Claude. For skin conditions (one of 5 MVP presentations), the AI assessment ignores the primary diagnostic evidence |

### P2 Phase 2 (before scaling beyond beta)

| PRD | Description |
|-----|-------------|
| [PRD-027](PRD-027-sms-notifications.md) | SMS notifications via Twilio — email-only engagement gap for time-sensitive clinical results |
| [PRD-024](PRD-024-family-accounts-multi-patient-profiles.md) | Family accounts — one login managing multiple patient profiles; large market segment currently blocked |

### P3 Phase 2 (post-beta)

| PRD | Description |
|-----|-------------|
| [PRD-028](PRD-028-escript-integration.md) | eScript integration (Fred Dispense / ScriptPad) — converts the service from advice-only to treatment-capable; unlocks the full clinical episode for medication-requiring presentations |
| [PRD-019](PRD-019-clinical-knowledge-base-proprietary.md) | Proprietary clinical knowledge (eTG, AMH, MIMS) — raises clinical AI quality ceiling for Australian prescribing guidance |

---

## Dependency Graph

```
PREREQ-001 (Regulatory & Legal Prerequisites)
  └─► All PRDs — legal sign-off required before beta launch

RESEARCH-002 (LLM & Voice Platform Evaluation — complete)
  └─► PRD-008 (voice platform decision: Gemini Live API / Retell.ai fallback)
  └─► PRD-011, PRD-012 (LLM decision: Claude Sonnet 4.6 via Bedrock — confirmed)

PRD-003 (Infrastructure)
  └─► PRD-004, PRD-005, PRD-006, PRD-007, PRD-008, PRD-009, PRD-010, PRD-011, PRD-012, PRD-013, PRD-014, PRD-015, PRD-016

PRD-004 (Auth)
  └─► PRD-006 (patient flows), PRD-007 (payment-gated), PRD-013 (doctor dashboard)

PRD-005 (Audit Log)
  └─► PRD-007 (payment events), PRD-008 (consultation start/end), PRD-012 (AI outputs), PRD-013 (doctor actions), PRD-014 (notifications)

PRD-006 (Patient Registration)
  └─► PRD-008 (profile context in AI interview)

PRD-007 (Payments — deferred, pre-beta)
  └─► PRD-008 prod (consultation payment gate — required before real patient billing, not for MVP testing)

PRD-008 (AI Voice)
  └─► PRD-012 (transcript fed to clinical AI engine)

PRD-009 (Text Fallback)
  └─► PRD-012 (transcript fed to clinical AI engine)

PRD-010 (Photo Upload)
  └─► PRD-012 (photos fed to photo analysis)

PRD-011 (Clinical Knowledge Base & RAG)
  └─► PRD-012 (knowledge base, pgvector, and system prompts required before Clinical AI Engine)
  └─► PRD-021 (content expansion builds on PRD-011 infrastructure)

PRD-012 (Clinical AI Engine)
  └─► PRD-013 (SOAP + diff + draft surfaces in doctor dashboard)
  └─► PRD-021 (new conditions available to engine without code changes once ingested)

PRD-021 (Clinical Knowledge Base Expansion)
  └─► PRD-019 (proprietary source expansion deferred until PRD-021 open-source content stable)

PRD-013 (Doctor Dashboard)
  └─► PRD-014 (approval triggers patient notification)
  └─► PRD-026 (photosAnalysed badge added to review ticket)
  └─► PRD-028 (eScript action added to review UI)

PRD-014 (Patient Notifications)
  └─► PRD-015 (follow-up triggered after notification sent)
  └─► PRD-027 (SMS extends email notification service)

PRD-015 (Follow-Up)
  └─► PRD-016 (end-to-end test includes follow-up flow)

PRD-010 (Photo Upload)
  └─► PRD-026 (uploaded photos passed to Claude Vision in engine)

PRD-012 (Clinical AI Engine)
  └─► PRD-026 (photo vision analysis extends engine pipeline)

PRD-018 (Script Renewals)
  └─► PRD-028 (renewal approval extended to generate real eScript)

PRD-025 (Doctor Onboarding)
  └─► PRD-028 (PBS prescriber number captured at onboarding; required for eScript issuance)

PRD-027 (SMS Notifications)
  └─► PRD-028 (dispense token delivered to patient via SMS)
```

---

## Research Findings & Architecture Decisions

Three research tracks were initiated April 2026. Key findings and confirmed decisions are summarised below; full documents are in [docs/research/](../research/).

### Data Storage & Security Compliance — Research Complete

**Architecture decision confirmed: Use AWS Bedrock (ap-southeast-2) instead of the direct Anthropic API.** This is the single most impactful data sovereignty decision — it keeps AI inference in Sydney, eliminates the APP 8 cross-border data disclosure trigger, and removes the need for a standalone Anthropic DPA. Full rationale in [2026-04-21-data-storage-compliance.md](../research/2026-04-21-data-storage-compliance.md).

**Note on data residency law:** There is no blanket legal requirement for health data to be stored in Australia for a private telehealth company (the My Health Records Act s77 restriction only applies if Nightingale integrates with the national MHR system, which is out of scope for Phase 1). The operative obligation is APP 8 — accountability for cross-border data disclosure remains with Nightingale regardless of DPAs.

**Confirmed infrastructure requirements (Sprint 0):**

| Requirement | Standard | Sprint |
|------------|---------|--------|
| Data residency | All patient data in AWS ap-southeast-2 (Sydney); backups to ap-southeast-4 (Melbourne) | Sprint 0 |
| Encryption at rest | AES-256, AWS KMS customer-managed keys; RDS encryption must be enabled at creation (cannot be added later) | Sprint 0 |
| Encryption in transit | TLS 1.3 minimum (not 1.2) enforced at load balancer and API gateway | Sprint 0 |
| Immutable audit log | Append-only storage (S3 object lock or WORM table); 7-year retention for consultation events | Sprint 0 |
| MFA | Mandatory for all doctor and admin accounts (TOTP minimum); hard gate, not optional | Sprint 0 |
| RBAC | Doctor data scoped to assigned consultations only; no standing admin production access | Sprint 0 |
| Medical photo storage | Separate S3 bucket, EXIF stripping on upload, short-lived signed URLs scoped to individual consultation | Sprint 3 |
| Security baseline | ASD Essential Eight Maturity Level 2 before launch (ML1 is the minimum for cyber insurance) | Pre-launch |
| Penetration testing | CREST-accredited pen test before first patient onboarded; scope covers web app, API, auth flows, photo pipeline | Pre-launch |
| Notifiable Data Breaches | 30-day notification to affected individuals + OAIC after becoming aware of an eligible breach; AUD 3.3M penalty for serious/repeated breaches | Operational |

**Third-party DPAs — must be executed before any patient data flows:**

| Vendor | Data Exposure | Required Action |
|--------|-------------|-----------------|
| AWS Bedrock (ap-southeast-2) | AI inference on anonymised data | Standard AWS DPA; data stays in AU — preferred path |
| Vapi / Retell.ai | Live audio, transcript fragments | Execute DPA; confirm AU data residency or no post-session data retention |
| Twilio | Patient name, phone, SMS content | Execute DPA; use AU data residency option where available |
| SendGrid | Patient name, email, doctor response content | Execute DPA |
| Stripe | Payment data combined with consultation context | Execute DPA; confirm scope with healthcare lawyer |

**Open legal questions requiring healthcare lawyer input before launch:**
1. Does Nightingale's anonymisation layer constitute de-identification under the Privacy Act, or pseudonymisation (still personal information)? — determines whether APP 8 is triggered for all LLM API calls
2. Do state health record laws (NSW HRIPA, VIC Health Records Act, etc.) impose storage or access obligations beyond the federal Privacy Act when a GP approves a consultation?
3. Does the NDB scheme require notifying patients of a breach at a third-party vendor (e.g., a Twilio breach exposing SMS content)?
4. Is a Stripe DPA sufficient for payment data combined with health consultation context, or does the combination create additional sensitivity?

**Estimated Year 1 compliance costs (AUD):**

| Item | Estimate |
|------|----------|
| Healthcare lawyer — DPAs + Privacy Policy | 5,000–10,000 |
| TGA pre-submission advice + Class IIa documentation | 20,000–50,000 |
| CREST penetration test (pre-launch) | 10,000–25,000 |
| AWS KMS + CloudTrail + S3 (incremental) | ~1,000/year |
| Cyber insurance (health sector) | 5,000–15,000/year |
| Annual penetration test (ongoing) | 8,000–15,000/year |
| **Year 1 total (estimate)** | **60,000–115,000** |

---

### Clinical AI Model Selection — Research In Progress

**Decision required by:** Sprint 4 start (Week 8) | **Owner:** CTO + Medical Director | **Document:** [2026-04-21-llm-model-selection.md](../research/2026-04-21-llm-model-selection.md)

Evaluation is underway across 7 weighted criteria. Candidates: Claude Sonnet/Opus (via Bedrock), GPT-4o, Gemini 1.5 Pro, Llama 3 70B.

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| Medical reasoning accuracy (MedQA, ClinicalBench benchmarks) | 30% | Core clinical task quality |
| Hallucination rate in medical context (drug names, dosages, contraindications) | 25% | Highest-risk failure mode |
| Clinical note quality (SOAP structure, patient-facing readability) | 20% | Directly evaluated on AU GP presentations |
| Multimodal medical imaging capability | 10% | Required for photo analysis subset |
| Australian data sovereignty & DPA | 10% | APP 8 compliance |
| Cost per consultation (target: < AUD $2 for all AI/infra) | 5% | Estimated ~4,800 tokens per consultation |
| Latency & API reliability (target: SOAP generation < 30 seconds) | 5% | Doctor queue responsiveness |

Clinical note quality is evaluated by blind GP review of outputs on 10 synthetic Australian GP presentations (URTI, UTI, skin rash, musculoskeletal, mental health).

**Voice platform evaluation** (Vapi vs Retell.ai) runs in parallel — decision required by Sprint 2 start. Key criteria: sub-500ms response latency, Australian accent accuracy, healthcare vocabulary, AU data residency.

**Research timeline:** Weeks 2–5 (benchmark review → blind SOAP evaluation → hallucination testing → data sovereignty check → cost modelling → final recommendation with Medical Director sign-off).

---

### Australian Clinical Knowledge Grounding — Research In Progress

**Decision required by:** Sprint 2 start (question trees) and Sprint 4 start (AI engine) | **Owner:** CTO + Medical Director | **Document:** [2026-04-21-australian-medical-knowledge.md](../research/2026-04-21-australian-medical-knowledge.md)

**Recommended approach confirmed: Hybrid RAG + structured system prompts.** Fine-tuning is not recommended for Phase 1 — cost, data privacy complications, and model staleness as guidelines update. NIGHTINGALE.md's version-controlled clinical prompt repository is extended with a RAG knowledge base grounded in Australian sources.

Without explicit Australian grounding, general-purpose LLMs default to US/UK guidelines, US brand names, NICE/CDC rather than RACGP, and US emergency services (911 instead of 000) — all of which create clinical and regulatory risk.

**Phase 1 knowledge sources (PRD-011 — open-source stack, no commercial licensing required):**

| Source | Type | Status |
|--------|------|--------|
| PBS API (data.pbs.gov.au) | Medication schedule — full monthly PBS listing | Free API key registration; Open Government Licence |
| MBS schedule (mbsonline.gov.au) | Medicare items, telehealth eligibility, referral items | Open Government Licence; no blocker |
| RACGP clinical guidelines + Red Book | GP standard of care for all 5 Phase 1 presentations | Freely available; attribution required |
| NHMRC approved guidelines | Evidence-based guidelines for diabetes, mental health | Freely available; Open Access Policy |
| SNOMED CT-AU + AMT (healthterminologies.gov.au) | Clinical terminology normalisation; AU medicines terminology | Free registration; SNOMED Affiliate Licence (free) — confirm commercial vector store use with ADHA |

**Phase 2 knowledge sources (PRD-019 — deferred to post-beta):**

| Source | Why Deferred |
|--------|-------------|
| eTG Complete (Therapeutic Guidelines) | Commercial AI licence required; deferred until Phase 1 quality baselines established |
| AMH (Australian Medicines Handbook) | Commercial AI licence required; deferred |
| MIMS Australia | Commercial AI integration agreement required; deferred |

**Vector database (MVP):** pgvector on the existing RDS PostgreSQL instance — sufficient for Phase 1 volume (200 consultations/month), zero additional infrastructure. Migrate to AWS OpenSearch (ap-southeast-2) if query latency degrades at scale.

**Hardcoded AHPRA regulatory language constraints** — applied to every system prompt, reviewed and signed off by regulatory advisor before Sprint 4:
- Use "assess" (not "diagnose"), "recommend" (not "prescribe in patient-facing responses"), "may indicate" or "is consistent with" (not "you have [condition]")
- Always include in patient-facing drafts: "This advice is not a substitute for in-person medical care" and emergency reference to 000
- Never include: medication brand names unless PBS-listed, off-label uses, claims of diagnostic certainty, references to 911

**Medical Director knowledge governance:** All question trees and system prompt changes require Medical Director PR approval before merge. Branch protection enforced on `question-trees/`, `regulatory/`, and system prompt templates. Monthly audit of AI output quality (amendment rate, rejection rate, confidence threshold performance).

**Research timeline:** Weeks 1–7 (eTG/AMH/MIMS licensing contacts → AHPRA language draft → question trees v1 for 5 presentations → RAG pipeline prototype on synthetic consultations → Medical Director blind comparison → governance workflow documented).

---

## Phase 1 Success Metrics

| Metric | Target |
|--------|--------|
| Consultations completed | 200 by Month 6 |
| AI draft approval rate (no amendment) | Baseline established |
| Patient satisfaction score | Baseline established |
| Doctor rejection rate | Baseline established |
| Average doctor review time | < 5 min per consultation |
| Average time-to-response | Tracked — no SLA at launch |

---

## Explicitly Out of Scope (Phase 1)

- Native mobile app (iOS/Android)
- Video consultation
- Electronic prescription (eScript) — Fred Dispense / ScriptPad (Phase 1 only; planned for Phase 2 in PRD-028)
- Medicare bulk billing
- Chronic condition management programs
- EMR integration
- Southeast Asia localisation
- Clinic white-label / SaaS licensing
- My Health Record sync — ADHA registration + conformance testing required; post-Phase 1
- Vitals / health monitoring integration — wearable or Apple Health data; post-Phase 1
- 24/7 live clinical support chat — human staffing model not in scope for MVP

---

## Key Open Decisions (Pre-Build)

| Decision | Status | Owner | Required By |
|----------|--------|-------|-------------|
| AWS Bedrock vs direct Anthropic API | **Resolved: AWS Bedrock** — eliminates APP 8 cross-border risk; data stays in AU. Final sign-off with lawyer still required. See [RESEARCH-002](../research/archive/2026-04-21-llm-voice-platform-evaluation.md). | CTO + Lawyer | Sprint 0 start |
| Voice AI platform | **Resolved: Gemini 2.5 Flash Live API (direct)** — native audio-in/out; ~$0.024 AUD/consult. **Contingent on GCP `australia-southeast1` Live API availability** — confirm before Sprint 2. Fallback: Retell.ai. See [RESEARCH-002](../research/archive/2026-04-21-llm-voice-platform-evaluation.md). | CTO | Sprint 2 start |
| Clinical LLM: Claude vs GPT-4o vs Gemini vs Llama 3 | **Resolved: Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2** — 4.70/5 weighted score; 92.3% MedQA; best hallucination profile. Hallucination trap test + Medical Director SOAP blind eval still required before Sprint 4. See [RESEARCH-002](../research/archive/2026-04-21-llm-voice-platform-evaluation.md). | CTO + Medical Director | Sprint 4 start |
| Auth provider: AWS Cognito vs Auth0 | **Resolved: AWS Cognito** — ap-southeast-2 data residency, free tier, native IAM integration (PRD-004 shipped) | CTO | ✅ Done |
| Clinical knowledge licensing: eTG / AMH / MIMS | **Deferred to PRD-019 (Phase 2).** Phase 1 knowledge base (PRD-011) uses open-source stack only: PBS API, MBS, RACGP guidelines, NHMRC guidelines, SNOMED CT-AU/AMT — no commercial licensing required. | CTO | Post-beta |
| AHPRA advertising language constraints | Open — draft in progress; requires sign-off from AHPRA advertising compliance reviewer | Regulatory Advisor | Sprint 4 start |
| Medical Director partner confirmed | Open | Founder | Pre-build |
| Prescription language in consultation results | **Open — must resolve before Sprint 4.** Design shows "Prescription & Dosage" but eScript is out of scope. Determine whether output is a formal recommendation or a GP-signed letter; confirm AHPRA-compliant language with lawyer. | CTO + Lawyer + Medical Director | Sprint 4 start |
| IHI / Medicare verification in patient profile | Open — design shows IHI verified via HI Service. Confirm whether Phase 1 collects Medicare number as optional free-text only (no HI Service lookup), or requires full IHI verification. HI Service integration is significant scope. | CTO + Lawyer | Sprint 1 start (PRD-006) |
