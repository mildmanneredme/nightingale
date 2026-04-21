# PRD-008 — AI Voice Consultation

> **Status:** Not Started
> **Phase:** Sprint 2 (Week 5–7)
> **Type:** Technical — Voice AI / Clinical
> **Owner:** CTO + Medical Director

---

## Overview

The AI voice agent conducts a structured clinical interview with the patient, lasting approximately 5–10 minutes. It follows symptom-specific question trees designed and approved by the Medical Director, detects red flag presentations requiring emergency escalation, and produces a complete transcript fed to the Clinical AI Engine.

---

## Background

### Open Decision: Vapi vs Retell.ai

This sprint is blocked on the voice AI platform evaluation (see `research/2026-04-21-llm-model-selection.md`). Key evaluation criteria:

| Factor | Requirement |
|--------|-------------|
| Latency | < 800ms end-to-end response latency |
| Australian accents | Must handle Australian/AUS English without degradation |
| Healthcare vocabulary | Medical terminology: symptoms, anatomical terms, medications |
| Data residency | No persistent storage of audio outside Australia preferred |
| HIPAA-equivalent compliance | Willingness to sign DPA (required under APP 8) |
| Pricing | Target < $1 AUD per consultation |
| Fallback | API allows graceful handoff to text-chat if audio quality fails |

Decision must be documented and approved by CTO before Sprint 2 starts.

### Clinical Question Trees

All clinical question logic is authored and version-controlled in the clinical prompt repository (established in PRD-001). Medical Director has final approval authority on all question tree changes via Git branch protection.

MVP covers 5 initial presentations:
1. Upper respiratory tract infection (URTI) / cold / flu symptoms
2. Urinary tract infection (UTI)
3. Skin conditions (rash, wound, lesion)
4. Musculoskeletal pain (back, joint, muscle)
5. General / undifferentiated presenting complaint

---

## Functional Requirements

### Pre-Interview

| # | Requirement |
|---|-------------|
| F-001 | Audio connection quality is tested at session start (minimum threshold: intelligibility score > 80%) |
| F-002 | If audio quality is insufficient, patient is offered text-chat fallback (PRD-009) |
| F-003 | Patient's profile (allergies, medications, conditions) and chief complaint are loaded as context before interview starts |
| F-004 | AI introduces itself, explains it is an AI assistant conducting a pre-consultation interview, and confirms the doctor will review the results |

### Voice Interview

| # | Requirement |
|---|-------------|
| F-005 | AI conducts a structured symptom interview following the approved question tree for the presenting complaint |
| F-006 | AI can dynamically branch question paths based on patient responses (e.g., follow-up duration questions if pain is mentioned) |
| F-007 | AI asks about: symptom onset, duration, severity (1–10 scale), character, location, radiation, aggravating/relieving factors, associated symptoms |
| F-008 | AI incorporates patient profile: asks about known allergies and current medications in context |
| F-009 | AI asks about: self-treatment attempts, prior medical history relevant to presenting complaint |
| F-010 | AI prompts patient to prepare for photo upload (if applicable to presentation) |
| F-011 | Interview target duration: 5–10 minutes; AI must not conduct interviews shorter than 3 minutes or longer than 15 minutes |
| F-012 | AI communicates in plain, accessible Australian English; no medical jargon in patient-facing speech |

### Red Flag Detection

| # | Requirement |
|---|-------------|
| F-013 | Real-time red flag detection runs on every patient utterance during the interview |
| F-014 | Red flag triggers: chest pain + shortness of breath, sudden severe headache ("thunderclap"), stroke symptoms (FAST), anaphylaxis, active bleeding, loss of consciousness, suicidal ideation |
| F-015 | On red flag detection: AI immediately pauses the interview, states clearly "This sounds like a medical emergency. Please call 000 immediately or have someone drive you to the nearest emergency department." |
| F-016 | Emergency instruction is repeated if patient does not confirm they will seek emergency help |
| F-017 | Red flag event is logged to audit trail immediately on detection (does not wait for consultation completion) |
| F-018 | Consultation is flagged as "emergency escalated" in the database; no doctor review queue entry created |
| F-019 | Consultation fee is waived for emergency escalations; automatic refund initiated |

### Transcript & Storage

| # | Requirement |
|---|-------------|
| F-020 | Full conversation transcript (patient utterances + AI responses) stored in database, linked to consultation ID |
| F-021 | Transcript stored in structured format: array of turns with speaker, text, timestamp, and confidence score |
| F-022 | Audio recordings are not stored — transcripts only (reduces storage footprint and data sensitivity) |
| F-023 | Transcript is available to: Clinical AI Engine (PRD-012), doctor review dashboard (PRD-013), admin audit |
| F-024 | Transcript is not included in patient-facing consultation response |

---

## Non-Functional Requirements

- **Latency:** AI response latency < 800ms (perceived as natural conversation)
- **Accuracy:** Transcription word error rate < 5% for clear Australian English speech
- **Uptime:** Voice service must have a fallback path to text-chat; voice outage must not block consultations
- **Privacy:** No patient audio stored on voice AI provider servers beyond session (validate with DPA)

---

## Clinical Question Trees (Initial Set)

Question trees are maintained in the clinical prompt repository. Each tree contains:
- Presenting complaint category
- Opening question
- Branch logic (IF symptom mentioned THEN follow-up)
- Required fields (minimum information to proceed)
- Red flag trigger phrases and conditions
- Photo prompt (yes/no and guidance if yes)

Medical Director must sign off on each tree before it is deployed. Changes to production question trees require Medical Director approval via Git branch protection.

---

## Acceptance Criteria

- [ ] Voice AI platform decision documented and DPA signed
- [ ] Audio quality check runs at session start; insufficient quality routes to text-chat
- [ ] AI can conduct a complete 5–10 minute interview for all 5 initial presentations
- [ ] AI correctly identifies at least 3 out of 3 red flag test scenarios (chest pain + SOB, thunderclap headache, anaphylaxis) and issues 000 instruction
- [ ] Emergency instruction is delivered before interview ends; consultation fee waived
- [ ] Full structured transcript saved to database on consultation completion
- [ ] Audio is not stored (confirm with voice AI provider; verify in DPA)
- [ ] Question trees for all 5 presentations reviewed and approved by Medical Director

---

## Dependencies

- PRD-001: Voice AI provider DPA must be signed; Medical Director must approve initial question trees
- PRD-003: Infrastructure provisioned
- PRD-004: Patient must be authenticated and have paid (linked to consultation ID)
- PRD-007: Payment confirmed before interview starts

---

## Out of Scope

- Video consultation (Phase 2)
- Multi-language support (Phase 2)
- Automatic voice agent updates without Medical Director review
- Real-time live transcription display to patient during interview (Phase 2 consideration)
