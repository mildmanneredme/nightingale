# PRD-009 — Text-Chat Fallback

> **Status:** Not Started
> **Phase:** Sprint 2 (Week 5–7)
> **Type:** Technical — Patient Web App
> **Owner:** CTO

---

## Overview

Patients on poor audio connections, or who prefer text, must be able to complete the same clinical interview entirely via text chat. The text-chat flow follows identical clinical question trees to the voice interview, produces the same structured transcript, and feeds the same Clinical AI Engine. No patient should be unable to complete a consultation because of audio constraints.

---

## Background

Voice consultation is the default and preferred mode because it:
- Produces richer clinical descriptions (patients speak more freely)
- Captures tone and affect that can signal anxiety or distress
- Is faster for patients

Text-chat is a fallback, not a downgraded product. The clinical output must be equivalent. The only differences are the input modality and the absence of real-time speech quality issues.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Patient | Types responses in chat interface; must be authenticated with confirmed payment |
| System | Clinical AI logic layer drives the question tree; same backend service as voice consultation |
| Doctor | No direct involvement; receives transcript via Clinical AI Engine (PRD-012) |

---

## Functional Requirements

### Fallback Trigger

| # | Requirement |
|---|-------------|
| F-001 | Text-chat mode is offered automatically when audio quality check fails (< 80% intelligibility threshold) |
| F-002 | Patient can manually select text-chat at any point in the consultation booking flow |
| F-003 | Consultation mode (voice or text-chat) recorded in consultation record before interview begins |
| F-004 | Switching from voice to text-chat mid-interview is not supported at MVP; patient must start fresh if voice fails mid-session |

### Text-Chat Interface

| # | Requirement |
|---|-------------|
| F-005 | Chat interface is a standard conversational UI: AI messages on left, patient messages on right |
| F-006 | AI sends one question at a time; patient types a free-text response and submits |
| F-007 | AI can send multiple-choice answer options for structured questions (e.g., pain severity 1–10 as button options) |
| F-008 | Patient can type a free-text response even when button options are provided |
| F-009 | Auto-suggestions or predictive text are not shown (to avoid anchoring patient responses) |
| F-010 | Typing indicator shown while AI is "processing" (200–500ms simulated delay for naturalistic pacing) |
| F-011 | Patient can scroll up to review earlier messages in the current consultation |

### Clinical Equivalence

| # | Requirement |
|---|-------------|
| F-012 | Text-chat uses the same clinical question trees as voice (same symptom categories, same branching logic) |
| F-013 | Red flag detection runs on every patient message; same triggers and escalation as PRD-008 |
| F-014 | Emergency escalation in text-chat shows a prominent on-screen message and a "Call 000" button (tappable on mobile) |
| F-015 | Photo upload prompt is shown at the appropriate point in the question tree (same as voice) |
| F-016 | Transcript format is identical to voice transcript: array of turns with speaker, text, and timestamp |

### Session Management

| # | Requirement |
|---|-------------|
| F-017 | Text-chat session persists if patient refreshes the page or navigates away (session state restored from server) |
| F-018 | Session times out after 30 minutes of inactivity; patient warned at 25 minutes |
| F-019 | Timed-out session is saved as a draft; patient can resume within 2 hours |
| F-020 | After 2 hours, draft session is discarded and patient must start a new consultation |

---

## Non-Functional Requirements

- **Mobile-first:** Chat interface must be fully functional on 375px mobile; keyboard must not obscure input field
- **Accessibility:** Meets WCAG 2.1 AA for text contrast, focus states, keyboard navigation
- **Latency:** AI text response delivered within 1.5 seconds of patient message submission

---

## Compliance Notes

**No new third-party integrations:** Text-chat uses the same clinical AI infrastructure as voice consultation. No additional DPAs are required beyond those already covered.

**AHPRA language:** Identical AHPRA constraints apply as in PRD-008. The text-chat system prompt must include the same hardcoded regulatory language constraints. Emergency escalation in text mode must render a tappable "Call 000" button on mobile — not just text.

**Anchor-free responses:** Auto-suggestions and predictive text are explicitly disabled (F-009) to avoid anchoring patient symptom descriptions, which would compromise clinical data quality.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `consultation.ai_consultation_started` | Text-chat session initiated; `consultation_mode = text` stored |
| `consultation.ai_consultation_ended` | Chat session complete; transcript committed to database |
| `consultation.red_flag_detected` | Red flag phrase detected in a patient message |
| `consultation.emergency_escalated` | Emergency instruction triggered in text-chat flow |

---

## Acceptance Criteria

- [ ] Text-chat mode offered automatically when audio quality check fails
- [ ] Patient can initiate text-chat manually from the consultation booking screen
- [ ] Complete consultation conducted via text-chat for all 5 initial presentations
- [ ] Red flag detection triggers "Call 000" banner in text interface for chest pain + SOB scenario
- [ ] Photo upload prompt appears at correct point in URTI and skin condition question trees
- [ ] Text transcript saved in same format as voice transcript (verified by inspection)
- [ ] Session restored if patient refreshes page mid-interview
- [ ] Chat interface usable on iPhone SE (375px width) without layout issues

---

## Dependencies

- PRD-008: Question trees and red flag detection logic shared with voice; text-chat uses the same clinical logic layer
- PRD-010: Photo upload prompt integration (patient offered photo upload at appropriate point)

---

## Out of Scope

- Rich media in chat (images, files sent by patient via chat — photo upload is a separate flow in PRD-010)
- Doctor-to-patient messaging (Phase 2)
- Live chat with a human support agent
