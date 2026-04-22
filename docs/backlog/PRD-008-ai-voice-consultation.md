# PRD-008 — AI Voice Consultation

> **Status:** Not Started
> **Phase:** Sprint 2 (Week 5–7)
> **Type:** Technical — Voice AI / Clinical
> **Owner:** CTO + Medical Director

---

## Overview

The AI voice agent conducts a structured clinical interview with the patient, lasting approximately 5–10 minutes. It follows symptom-specific question trees designed and approved by the Medical Director, detects red flag presentations requiring emergency escalation, and produces a complete transcript fed to the Clinical AI Engine (PRD-012).

---

## Background

### Voice Integration: Gemini 2.5 Flash Live API

The voice layer uses **Gemini 2.5 Flash Live API** via GCP Vertex AI, integrated directly over WebSocket — not via a third-party voice platform (Vapi/Retell.ai). This decision was made in PRD-002.

**Why direct Gemini Live API over managed voice platforms:**

| Factor | Managed platform (Retell/Vapi) | Gemini Live API (direct) |
|--------|-------------------------------|--------------------------|
| Latency mechanism | ASR → external LLM → TTS chain | Native audio-in / audio-out — no chain |
| Real-world latency | 700ms–7s depending on provider chain | Target <500ms |
| Voice cost per consultation | $0.92–$8.29 AUD (platform fee + HIPAA) | ~$0.024 AUD |
| Engineering overhead | Low (managed SDK) | **Higher — custom WebSocket integration** |
| Third-party DPA required | Yes (Retell or Vapi) | GCP DPA (already required for Vertex AI) |

**Fallback:** If Gemini Live API cannot be confirmed for GCP `australia-southeast1` (required for APP 8 compliance), the fallback is **Retell.ai** with on-premise SIP trunk. The functional requirements below are written to be platform-neutral where possible.

### Post-Consultation Intelligence: Claude Sonnet 4.6 via Bedrock

The voice layer (Gemini) conducts the interview and produces a transcript. The clinical intelligence layer (Claude Sonnet 4.6 on AWS Bedrock ap-southeast-2) handles all post-consultation outputs: SOAP note, differential diagnosis, and patient-facing draft. These are separate concerns handled by separate PRDs:

- Voice consultation (this PRD) → produces transcript
- Clinical AI Engine (PRD-012) → consumes transcript, produces clinical outputs

### Clinical Question Trees

All clinical question logic is authored and version-controlled in the clinical prompt repository (established in PRD-001). The question tree for the presenting complaint is injected into the Gemini session as the system prompt before the interview starts. Medical Director has final approval authority on all question tree changes via Git branch protection.

MVP covers 5 initial presentations:
1. Upper respiratory tract infection (URTI) / cold / flu symptoms
2. Urinary tract infection (UTI)
3. Skin conditions (rash, wound, lesion)
4. Musculoskeletal pain (back, joint, muscle)
5. General / undifferentiated presenting complaint

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Participates in voice interview; must be authenticated with confirmed payment |
| System | Gemini Live API conducts the interview; Nightingale backend manages the WebSocket relay and server-side red flag detection |
| Doctor | No direct involvement; receives structured transcript indirectly via the Clinical AI Engine (PRD-012) |

---

## Architecture

### Session Flow

```
1. Patient opens consultation in web app (authenticated + payment confirmed)
2. Backend selects question tree for presenting complaint
3. Backend opens Gemini Live API WebSocket session (GCP australia-southeast1)
   — System prompt = [question tree] + [AHPRA constraints] + [patient profile context]
4. Patient audio streams to Gemini via WebSocket (browser MediaStream API)
5. Gemini responds in real-time native audio — no ASR/TTS round-trip
6. Red flag phrases monitored server-side on transcript deltas during session
7. Session ends (patient or AI closes) — Gemini returns full transcript
8. Transcript persisted to database (linked to consultation ID)
9. Consultation status set to "transcript_ready" — triggers PRD-012 pipeline
```

### WebSocket Integration Requirements

| Component | Implementation |
|-----------|---------------|
| Session initiation | Backend (Node.js/Python) opens authenticated Gemini Live WebSocket; injects system prompt |
| Audio streaming | Browser captures MediaStream; audio chunks sent to backend relay; relayed to Gemini WebSocket |
| Audio playback | Gemini audio chunks streamed back to browser; played via Web Audio API |
| Transcript accumulation | Server accumulates turn-by-turn transcript deltas from Gemini session events |
| Session timeout | Server enforces 15-minute hard limit; graceful close with partial transcript saved |
| Reconnection | Automatic reconnect on transient WebSocket drop (<30s); patient prompted if session cannot be restored |
| Fallback trigger | If Gemini Live session fails to establish after 3 retries, patient is offered text-chat (PRD-009) |

---

## Functional Requirements

### Pre-Interview

| # | Requirement |
|---|-------------|
| F-001 | Audio connection quality tested at session start: browser microphone permission granted, minimum audio level detected, round-trip to Gemini Live API confirms <1s initial response |
| F-002 | If audio quality is insufficient or Gemini Live session fails to establish, patient is immediately offered text-chat fallback (PRD-009) with no consultation restart required |
| F-003 | Patient profile (allergies, medications, chronic conditions) and chief complaint loaded as context; injected into Gemini system prompt before session opens |
| F-004 | AI introduces itself, confirms it is an AI assistant conducting a pre-consultation interview, and states the doctor will review the results before any response is sent to the patient |

### Voice Interview

| # | Requirement |
|---|-------------|
| F-005 | AI conducts a structured symptom interview following the Medical Director-approved question tree for the presenting complaint |
| F-006 | AI branches question paths dynamically based on patient responses (e.g., follow-up duration and severity questions if pain is mentioned) |
| F-007 | AI covers: symptom onset, duration, severity (1–10 scale), character, location, radiation, aggravating/relieving factors, associated symptoms |
| F-008 | AI incorporates patient profile in questioning: confirms known allergies and current medications in context of the presenting complaint |
| F-009 | AI asks about: self-treatment attempts, prior medical history relevant to presenting complaint |
| F-010 | AI prompts patient to prepare for photo upload if applicable to the presentation (skin, throat, wound) |
| F-011 | Interview target duration: 5–10 minutes; server enforces minimum 3 minutes and maximum 15 minutes; AI is instructed to wrap up if approaching the limit |
| F-012 | AI communicates in plain, accessible Australian English; no medical jargon in patient-facing speech; uses "assess" not "diagnose"; references 000 for emergencies |

### Red Flag Detection

| # | Requirement |
|---|-------------|
| F-013 | Server-side red flag detection runs on every transcript delta during the session (not dependent on Gemini detecting it) |
| F-014 | Red flag triggers: chest pain + shortness of breath, sudden severe headache ("thunderclap"), stroke symptoms (FAST criteria), signs of anaphylaxis, active uncontrolled bleeding, reported loss of consciousness, expression of suicidal ideation or intent |
| F-015 | On red flag detection: Gemini session is sent an interrupt instruction; AI states clearly: "This sounds like a medical emergency. Please call 000 immediately or have someone drive you to the nearest emergency department." |
| F-016 | Emergency instruction is repeated if patient does not confirm they will seek emergency help within the next two turns |
| F-017 | Red flag event is written to the audit log immediately on detection — does not wait for consultation completion |
| F-018 | Consultation marked "emergency_escalated" in database; no doctor review queue entry created |
| F-019 | Consultation fee is waived automatically; refund initiated via Stripe (PRD-007) |

### Transcript & Storage

| # | Requirement |
|---|-------------|
| F-020 | Full conversation transcript stored in database on session end, linked to consultation ID; format is an ordered array of turns: `{speaker, text, timestamp_ms, confidence}` |
| F-021 | Transcript stored server-side only — Gemini Live API session audio is not retained by Google beyond the active session (confirm in GCP DPA review) |
| F-022 | Audio is never written to Nightingale's own storage — transcript only |
| F-023 | Transcript available to: Clinical AI Engine (PRD-012), Doctor Review Dashboard (PRD-013), admin audit |
| F-024 | Transcript is not surfaced in the patient-facing consultation response |

---

## Non-Functional Requirements

- **Latency:** Gemini Live native audio targets <500ms perceived response. If fallback to Retell.ai: <800ms acceptable.
- **Accuracy:** Transcription word error rate < 5% on clear Australian English speech (validate with AU accent samples before Sprint 2 start)
- **Uptime:** Voice layer failure must not block consultations — text-chat fallback (PRD-009) must be live before voice goes live
- **Privacy:** Gemini Live API session audio must not be retained by Google post-session; confirm in GCP DPA before first patient. No Nightingale-side audio storage.
- **Data residency:** Gemini Live API must process within GCP `australia-southeast1` — this is a hard requirement. If unavailable, use Retell.ai fallback.

---

## Clinical Question Trees (Initial Set)

Question trees are maintained in the clinical prompt repository. Each tree is structured as a Gemini system prompt and contains:

- Presenting complaint category and opening question
- Branch logic: IF [symptom/keyword detected] THEN [follow-up question or path]
- Required fields: minimum information the AI must collect before closing the interview
- Red flag trigger phrases and escalation instruction
- Photo prompt flag and guidance text (injected when relevant to presentation)
- AHPRA language constraints (hardcoded; not branching)

Medical Director must sign off on each tree before it is deployed. Changes to production question trees require Medical Director approval via Git branch protection on the clinical prompt repository.

---

## Compliance Notes

**Privacy Act / APP 8:** Gemini Live API must process audio within GCP `australia-southeast1`. This is a hard compliance requirement — if that region is unavailable for the Live API, the Retell.ai fallback applies before any patient audio is processed.

**Audio retention:** Audio must not be stored on Nightingale's own systems. Transcript is stored; audio is discarded on session end. The GCP DPA must explicitly confirm no post-session audio retention by Google before first patient use.

**AHPRA language:** AHPRA constraints are hardcoded into every Gemini session system prompt. AI uses "assess" not "diagnose"; references 000 for emergencies; uses "may indicate" not "you have [condition]". Constraints are defined in the clinical prompt repository (PREREQ-001).

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `consultation.ai_consultation_started` | Gemini Live WebSocket session successfully opened |
| `consultation.ai_consultation_ended` | Session closed; full transcript committed to database |
| `consultation.red_flag_detected` | Red flag phrase triggers server-side; written immediately, does not wait for session end |
| `consultation.emergency_escalated` | 000 instruction issued; fee waiver and refund triggered |

---

## Acceptance Criteria

- [ ] Gemini Live API confirmed available in GCP `australia-southeast1`; GCP DPA reviewed and AU data residency confirmed
- [ ] WebSocket relay layer built and tested: browser audio streams to Gemini, Gemini audio streams back
- [ ] Audio quality check at session start; insufficient quality or failed session establishment routes to text-chat
- [ ] AI can conduct a complete 5–10 minute interview for all 5 initial presentations
- [ ] AI correctly identifies all 3 red flag test scenarios (chest pain + SOB, thunderclap headache, anaphylaxis) and issues 000 instruction before interview closes
- [ ] Emergency escalation: audit log entry written immediately on detection; fee waived; no queue entry created
- [ ] Full structured transcript saved to database on session end; audio not stored (confirmed in DPA and verified in Nightingale storage logs)
- [ ] Question trees for all 5 presentations reviewed and approved by Medical Director
- [ ] Text-chat fallback (PRD-009) live and tested before voice goes live
- [ ] If Retell.ai fallback is used instead: Retell.ai DPA executed and AU data residency confirmed

---

## Dependencies

- PRD-001: Medical Director confirmed; clinical prompt Git repository created with branch protection; question trees v1 authored
- PRD-002: Voice platform decision confirmed (Gemini Live API region availability, or Retell.ai fallback decision)
- PRD-003: Infrastructure provisioned; backend able to open outbound WebSocket to GCP
- PRD-004: Patient authenticated
- PRD-007: Payment confirmed before interview starts
- PRD-009: Text-chat fallback live before voice goes live

---

## Out of Scope

- Video consultation (Phase 2)
- Multi-language support (Phase 2)
- Real-time live transcription display to patient during interview (Phase 2 consideration)
- Automatic question tree updates without Medical Director review
- Phone/PSTN integration (web-only for Phase 1; PSTN requires separate telephony provider)
