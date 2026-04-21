# PRD-012 — Clinical AI Engine

> **Status:** Not Started
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

### Open Decision: LLM Selection

This sprint is blocked on the LLM model evaluation (see `research/2026-04-21-llm-model-selection.md`). The current plan assumes Claude (Anthropic) via AWS Bedrock, but formal evaluation is required. Key requirements:

| Requirement | Target |
|-------------|--------|
| Medical reasoning accuracy | Top-tier on MedQA / ClinicalBench |
| Hallucination rate (medical) | < 2% on trap test set of 20 deliberate wrong-answer prompts |
| Clinical note quality | > 4/5 average rating from Medical Director blind evaluation |
| Photo analysis (multimodal) | Adequate for dermatology / wound assessment |
| Data sovereignty | AWS Bedrock preferred (keeps inference in ap-southeast-2) |
| Cost per consultation | < $2 AUD (~4,800 tokens estimated per consultation) |
| Latency | < 30 seconds for full SOAP + differentials + draft response |

### Anonymisation Layer

Before any patient data is sent to an external LLM API, **PII must be stripped**. This is required under the Privacy Act (APP 8 cross-border disclosure obligations). The anonymisation layer is part of this PRD.

### Australian Clinical Guidelines

The clinical AI system prompts must ground the model in Australian clinical guidelines, not US/UK defaults. See `research/2026-04-21-australian-medical-knowledge.md` for the full RAG architecture. Key sources:
- eTG Complete (Therapeutic Guidelines Australia)
- RACGP clinical guidelines
- PBS (Pharmaceutical Benefits Scheme) — correct Australian medication names and availability
- AMH (Australian Medicines Handbook)

Medical Director must approve all system prompts before production deployment.

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
| F-013 | Each differential includes: diagnosis name, likelihood rating (high/medium/low), and 1–2 sentence clinical rationale |
| F-014 | Differentials are ranked by likelihood (most likely first) |
| F-015 | Confidence levels for each differential must be calibrated: "high" = AI has strong evidence from transcript; "low" = speculative, limited information |
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
| F-022 | If all differentials are rated "low" confidence: consultation is flagged as "low confidence" in doctor dashboard |
| F-023 | If transcript is < 3 minutes (insufficient information): consultation is flagged as "incomplete interview" in doctor dashboard |
| F-024 | Flagged consultations appear at top of doctor review queue with flag indicator |

### Photo Analysis

| # | Requirement |
|---|-------------|
| F-025 | If photos are present, photo analysis is performed by the LLM's vision capability |
| F-026 | Photo analysis output is appended to the SOAP note as a separate "Imaging / Visual" section |
| F-027 | Photo analysis must include confidence caveat: "AI visual assessment; clinical judgement required" |
| F-028 | If photo quality was flagged as poor at upload (PRD-010), this is noted in the photo analysis section |

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

## Acceptance Criteria

- [ ] For a test consultation transcript, engine produces SOAP note, differential list, and draft patient response within 30 seconds
- [ ] SOAP note contains all 4 sections; differential list contains 2–5 entries with likelihood ratings
- [ ] Automated PII test confirms no Medicare numbers, full names, or DOBs in API payload
- [ ] Photo analysis appended to SOAP note for consultation with uploaded photos
- [ ] Low confidence flag appears in doctor dashboard for consultation where all differentials are rated "low"
- [ ] Model version and prompt hash appear in audit log for every engine invocation
- [ ] Differentials reference Australian medications (e.g., PBS-listed drug names, not US brand names)
- [ ] Medical Director has reviewed and approved all system prompts before deployment

---

## Dependencies

- PRD-001: Medical Director must approve system prompts; LLM provider DPA (if direct API) or AWS Bedrock decision confirmed
- PRD-002: Clinical LLM selection confirmed; data sovereignty DPA requirements identified
- PRD-003: AWS Bedrock (or direct API) connection provisioned
- PRD-005: Audit log captures engine invocation details
- PRD-008 / PRD-009: Transcript produced by voice or text-chat interview
- PRD-010: Photo S3 keys passed to engine
- PRD-011: Clinical knowledge base v1 complete; pgvector indexed; system prompt templates Medical Director-approved; AHPRA language constraints signed off

---

## Out of Scope

- Real-time clinical decision support during the voice interview (the engine runs post-interview, not in-flight)
- Prescription generation (Phase 2 — eScript integration)
- Pathology or radiology order generation (Phase 2)
- Continuous model retraining from consultation data (Phase 2+)
