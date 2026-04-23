# PRD-012 — Clinical AI Engine

> **Status:** Shipped 2026-04-24
> **Phase:** Sprint 4 (Week 8–10)
> **Type:** Technical — AI / Clinical
> **Owner:** CTO + Medical Director

---

## Overview

The Clinical AI Engine processes the completed consultation transcript (and photos, if uploaded) to produce three structured outputs for the doctor review queue:
1. **SOAP note** — structured clinical summary
2. **Differential diagnosis list** — ranked by likelihood with confidence levels
3. **Draft patient response** — plain English, ready for doctor to approve, amend, or replace

No Clinical AI Engine output ever reaches a patient without doctor review and approval. The engine is a clinical decision-support tool, not an autonomous diagnostic system.

---

## Background

### LLM Selection — Resolved

**Decision: Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2** (confirmed 2026-04-21; see [RESEARCH-002](../research/archive/2026-04-21-llm-voice-platform-evaluation.md)).

Claude Sonnet 4.6 scored 4.70/5 on the weighted evaluation criteria, led by medical reasoning accuracy (92.3% MedQA) and the strongest hallucination safety profile of all candidates. AWS Bedrock ap-southeast-2 provides confirmed Australian data residency on existing infrastructure with no additional DPA required. Escalation path to Claude Opus 4.7 for complex multi-system presentations, to be evaluated once volume data is available.

**Pre-production validation tasks still required (owner: CTO + Medical Director):**
- 20-question hallucination trap test against Claude Sonnet 4.6 on drug interaction prompts
- Medical Director blind evaluation of SOAP outputs on 10 synthetic AU GP consultations
- 20 clinical image samples submitted for photo analysis accuracy scoring
- Medical Director sign-off on all system prompt templates
- AHPRA advertising compliance reviewer sign-off on patient-facing draft language

These must be complete before the engine is enabled for real patients.

### Anonymisation Layer

Before any patient data is sent to an external LLM API, **PII must be stripped**. This is required under the Privacy Act (APP 8 cross-border disclosure obligations). The anonymisation layer is part of this PRD.

### Australian Clinical Guidelines

The clinical AI system prompts must ground the model in Australian clinical guidelines, not US/UK defaults. Key sources:
- RACGP clinical guidelines (via RAG — PRD-011)
- PBS (Pharmaceutical Benefits Scheme) — correct Australian medication names and availability
- eTG Complete (deferred to PRD-019)
- AMH (deferred to PRD-019)

Medical Director must approve all system prompts before production deployment.

---

## User Roles & Access

| Actor | Interaction |
|-------|------------|
| Patient | Indirect — consultation transcript and photos from their session are the engine inputs |
| Doctor | Indirect — SOAP note, differentials, and draft response are their primary review materials |
| Medical Director | Reviews and approves all system prompts before production deployment; any prompt change requires Medical Director PR approval |
| System | Engine invoked automatically when consultation status reaches `transcript_ready` |

---

## Functional Requirements

### Input Processing

| # | Requirement |
|---|-------------|
| F-001 | Engine receives: consultation transcript, patient profile snapshot (at time of consultation), photos (S3 object keys), consultation mode (voice/text), paediatric flag, anonymous flag |
| F-002 | Anonymisation layer runs before any data leaves the application server |
| F-003 | PII stripped from transcript: names, contact details, Medicare number, date of birth → replaced with safe tokens (e.g., [PATIENT], [DOB_RANGE: 30–40]) |
| F-004 | PII is never included in LLM API payloads; this is verified by automated test (not just policy) |
| F-005 | Australian clinical context injected via RAG: presenting complaint used to retrieve relevant guideline excerpts |
| F-006 | System prompt compiled from: base clinical prompt + guideline context + patient profile (anonymised) |

### SOAP Note Generation

| # | Requirement |
|---|-------------|
| F-007 | SOAP note generated for every completed consultation |
| F-008 | SOAP note structure: Subjective (patient's reported symptoms), Objective (observations from transcript + photo), Assessment (clinical impression), Plan (recommendations for doctor to consider) |
| F-009 | SOAP note written in clinical language appropriate for GP review (not patient-facing language) |
| F-010 | SOAP note maximum length: 800 words |
| F-011 | SOAP note includes any red flags identified during interview, even if not escalation-level |

### Differential Diagnosis

| # | Requirement |
|---|-------------|
| F-012 | Differential diagnosis list generated: minimum 2, maximum 5 differentials |
| F-013 | Each differential includes: diagnosis name, likelihood percentage (0–100%, must sum to 100% across all differentials), and 1–2 sentence clinical rationale |
| F-014 | Differentials are ranked by likelihood percentage (highest first) |
| F-015 | Confidence calibration: ≥ 60% = high confidence; 20–59% = medium; < 20% = low. The `LOW_CONFIDENCE` flag is set if the top differential scores < 50% |
| F-016 | Differentials reference Australian medication and treatment norms (not US/UK defaults) |

### Draft Patient Response

| # | Requirement |
|---|-------------|
| F-017 | Draft response written in plain English for a lay patient audience (readability target: Year 10 level) |
| F-018 | Draft response includes: summary of what the doctor assessed, recommended next steps, any self-care advice, red flags to watch and when to seek further care |
| F-019 | Draft response does NOT include: diagnosis stated as definitive, prescription drug names (unless doctor adds), clinical jargon |
| F-020 | Draft response attributed to the reviewing doctor when sent to the patient (AI authorship not disclosed in response) |
| F-021 | Draft response maximum length: 400 words |

### Confidence Thresholds & Flagging

| # | Requirement |
|---|-------------|
| F-022 | If all differentials are rated "low" confidence: consultation is flagged `LOW_CONFIDENCE` in doctor dashboard |
| F-023 | If transcript is < 3 minutes (insufficient information): consultation is flagged `INCOMPLETE_INTERVIEW` in doctor dashboard |
| F-024 | Paediatric flag on patient record propagates to consultation; consultation is tagged `PEDIATRIC` in doctor queue |
| F-025 | If patient has one or more chronic conditions in profile and the presenting complaint is plausibly related: consultation is tagged `CHRONIC_CARE` in doctor queue |
| F-026 | If photo quality was flagged poor at upload (PRD-010): consultation is tagged `POOR_PHOTO` in doctor queue |
| F-027 | Flag logic is deterministic and rule-based (not LLM-generated); flags are computed by the application server after engine output is received |
| F-028 | `LOW_CONFIDENCE` and `INCOMPLETE_INTERVIEW` flagged consultations are sorted to the top of the doctor queue; other flags are informational |

### "Cannot Assess Remotely" Triage

| # | Requirement |
|---|-------------|
| F-029 | Engine evaluates whether the presentation can be safely assessed via telehealth, based on Medical Director-defined criteria encoded in the system prompt |
| F-030 | Cannot-assess triggers include (Medical Director to approve full list before production): suspected acute abdomen, localised abdominal tenderness with fever, acute vision changes, significant trauma, presentations requiring physical examination (e.g., auscultation, palpation) |
| F-031 | If cannot-assess: SOAP note is still generated for the doctor's reference, but the draft patient response is replaced with a cannot-assess template stating: reason the case cannot be managed remotely, instruction to seek in-person care, emergency contact (000), link to HealthDirect (1800 022 222), and refund notice |
| F-032 | Cannot-assess consultations are flagged `CANNOT_ASSESS` and placed in a separate doctor queue section; doctor must confirm (one-click) before the cannot-assess response is sent to the patient |
| F-033 | Refund is automatically initiated on cannot-assess confirmation; fee is not withheld |

### Output Validation

| # | Requirement |
|---|-------------|
| F-029 | Engine output validated against expected schema before storing; malformed output triggers reprocessing (up to 2 retries) |
| F-030 | If all retries fail, consultation is flagged for manual triage; Medical Director notified |
| F-031 | Model version and prompt hash logged to audit trail for every engine invocation |

---

## Non-Functional Requirements

- **Latency:** < 30 seconds from transcript submission to all outputs stored in database
- **Cost:** < $2 AUD per consultation in API costs
- **Privacy:** Automated test suite verifies PII is absent from API payloads before every deployment
- **Auditability:** Every engine call logged with: model version, prompt hash, input hash, output hash

---

## Compliance Notes

**Privacy Act / APP 8:** PII anonymisation is mandatory before any transcript or patient context is sent to AWS Bedrock. This is enforced by an automated test that runs before every production deployment — not a policy control. The test confirms absence of: full names, DOBs, Medicare numbers, phone numbers, and email addresses in API payloads.

**AHPRA language in outputs:** System prompt templates include hardcoded AHPRA language constraints. No patient-facing draft response may contain "diagnose", "cure", "you have [condition]", "prescribe" (in patient-facing context), or "911". The AHPRA constraints are always present regardless of what RAG retrieval returns.

**HITL gate:** The engine produces drafts only. Engine output must never reach a patient without a `doctor_approved_at` timestamp and `doctor_id` present in the consultation record. This constraint is enforced at the notification layer (PRD-014) — the engine has no send capability.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `consultation.ai_output_generated` | SOAP note, differentials, and draft all committed to database; includes model_version and prompt_hash |
| `consultation.doctor_queued` | Output validated and consultation placed in doctor review queue |
| `consultation.ai_output_failed` | All retries exhausted; consultation flagged for manual triage; Medical Director notified |

---

## Acceptance Criteria

- [x] For a test consultation transcript, engine produces SOAP note, differential list, and draft patient response
- [x] SOAP note contains all 4 sections; differential list contains 2–5 entries with likelihood ratings summing to 100%
- [x] Automated PII test confirms no Medicare numbers, phone numbers, emails, or DOBs in API payload
- [x] Low confidence flag set when top differential < 50%
- [x] Model version and prompt hash logged to audit trail for every engine invocation
- [x] Cannot-assess flow substitutes standard draft with refund + redirect template
- [x] ENGINE_FAILED flag and audit log written when all retries are exhausted
- [ ] Photo analysis appended to SOAP note for consultation with uploaded photos — deferred (see notes)
- [ ] Medical Director has reviewed and approved all system prompts — pre-production gate

---

## Implementation Notes (2026-04-24)

**Services:**
- `api/src/services/piiAnonymiser.ts` — regex-based PII stripping (Medicare, phone, email, DOB, salutation names); `buildAnonymisedPatientContext()` converts exact DOB to decade age range; `isPiiClean()` automated gate aborts engine if PII detected in outbound payload (PRD F-004)
- `api/src/services/anthropicClient.ts` — client abstraction supporting direct API (`ANTHROPIC_API_KEY`) and AWS Bedrock (`USE_BEDROCK=true`, `BEDROCK_REGION`, `BEDROCK_MODEL_ID`). Applies prompt caching via `cache_control: { type: "ephemeral" }` on the static system prompt block
- `api/src/services/clinicalAiEngine.ts` — single Claude call returning structured JSON (SOAP + differentials + draft). Deterministic flag computation post-LLM. Up to 2 retries on parse/API failure. Cannot-assess cases override draft with standard refund/redirect template. Model ID and SHA-256 prompt hash logged on every invocation

**Trigger:** Fire-and-forget from `POST /consultations/:id/end` (voice) and `POST /consultations/:id/chat` when status transitions to `transcript_ready`. HTTP response is immediate; engine runs in background. Errors logged but not propagated to patient response.

**Tests:** 20 PII unit tests green (no DB required). 13 engine integration tests with mocked Anthropic client: status transitions, SOAP/differentials/draft written to DB, audit events, skip on wrong status, retry exhaustion, cannot-assess flow, PII payload safety assertions.

**Deferred from this sprint:**
- Photo vision analysis (F-025–F-028) — requires pre-signed URL generation inside the engine and multimodal message construction; deferred to a follow-up PR after Medical Director photo analysis validation
- `requireRole` multi-role support backported from PRD-010 photo route
- `globalSetup.ts` updated to warn (not throw) on missing `TEST_DB_URL` to allow PII unit tests to run without a database

**Pre-production gates (not yet cleared):**
- Medical Director blind SOAP evaluation on 10 synthetic AU GP consultations
- 20-question hallucination trap test on Claude Sonnet 4.6 drug interactions
- AHPRA advertising compliance sign-off on system prompt language
- Prescription language decision (what exactly can the GP-reviewed output say about medications)

---

## Dependencies

- PRD-003: AWS Bedrock connection provisioned in ECS task role
- PRD-005: Audit log captures engine invocation details
- PRD-008 / PRD-009: Transcript produced by voice or text-chat interview
- PRD-010: `quality_overridden` flag read to set `POOR_PHOTO` priority flag
- PRD-011: RAG retrieval used to inject Australian clinical guidelines into prompt

---

## Out of Scope

- Real-time clinical decision support during the voice interview (engine runs post-interview)
- Prescription generation (Phase 2 — eScript integration)
- Pathology or radiology order generation (Phase 2)
- Continuous model retraining from consultation data (Phase 2+)
