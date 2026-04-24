# Project Nightingale — Master Roadmap

> **Status:** In Progress — Sprint 7 (Security Hardening & UX Fixes)
> **Phase:** 1 MVP (Months 1–6)
> **Target:** 100 beta patients, 200 consultations completed
> **Last updated:** 2026-04-24 (Security & UX audit complete — 9 new PRDs added)

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

| [PRD-019](PRD-019-clinical-knowledge-base-proprietary.md) | Clinical Knowledge Base: Proprietary Extensions (eTG, AMH, MIMS) | Phase 2 | Post-Beta | After PRD-011 in production | Not started |
| [PRD-020](../shipped/PRD-020-patient-web-frontend.md) | Patient Web Frontend | Build | Sprint 2 | Week 5–7 | **Shipped 2026-04-23** ✅ |
| — | — | — | — | — | — |
| **SEC-001** | [Critical Authorization Fixes](../shipped/SEC-001-critical-authorization-fixes.md) | Security Hardening | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **SEC-002** | [Email & Webhook Security](../shipped/SEC-002-email-webhook-security.md) | Security Hardening | Sprint 7 | Week 14–15 | **Shipped 2026-04-24** ✅ |
| **SEC-003** | [API Hardening: Rate Limiting, Headers & Validation](SEC-003-api-hardening.md) | Security Hardening | Sprint 7 | Week 14–15 | Not started — **P0 pre-beta blocker** |
| **SEC-004** | [Session & Token Security](SEC-004-session-token-security.md) | Security Hardening | Sprint 7 | Week 15–16 | Not started — P1 |
| **SEC-005** | [Renewal Business Logic Integrity](SEC-005-renewal-integrity.md) | Security Hardening | Sprint 7 | Week 15–16 | Not started — P1 |
| **UX-001** | [Consultation Result & State Display](UX-001-consultation-result-display.md) | UX Fixes | Sprint 7 | Week 14–15 | Not started — **P0 pre-beta blocker** |
| **UX-002** | [Patient History & Inbox Improvements](UX-002-patient-history-inbox.md) | UX Fixes | Sprint 7 | Week 15–16 | Not started — P1 |
| **UX-003** | [Admin Portal: Layout, Navigation & Auth](UX-003-admin-portal.md) | UX Fixes | Sprint 7 | Week 15–16 | Not started — P1 |
| **UX-004** | [Patient Profile Completeness](UX-004-patient-profile-completeness.md) | UX Fixes | Sprint 7 | Week 16 | Not started — P2 |

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

PRD-012 (Clinical AI Engine)
  └─► PRD-013 (SOAP + diff + draft surfaces in doctor dashboard)

PRD-013 (Doctor Dashboard)
  └─► PRD-014 (approval triggers patient notification)

PRD-014 (Patient Notifications)
  └─► PRD-015 (follow-up triggered after notification sent)

PRD-015 (Follow-Up)
  └─► PRD-016 (end-to-end test includes follow-up flow)
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
- Electronic prescription (eScript) — Fred Dispense / ScriptPad
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
