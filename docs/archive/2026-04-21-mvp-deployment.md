# MVP Deployment Plan — Project Nightingale Phase 1

> **Status:** Planning — April 2026
> **Scope:** Phase 1 (Months 1–6) MVP as defined in NIGHTINGALE.md §14

---

## Goal

Deploy a working AI-first telehealth service capable of handling paid patient consultations, from AI voice interview through to doctor-reviewed response delivery. Target: 100 beta patients, 200 consultations completed.

---

## Phase 1 MVP — What We Are Building

Based on NIGHTINGALE.md §14, Phase 1 includes:

| Component | Description |
|-----------|-------------|
| Patient web app | Mobile-responsive React SPA (no native app) |
| AI voice consultation | Voice agent (Vapi or Retell.ai — see research/llm-model-selection) |
| Text-chat fallback | For poor audio connections |
| Photo upload | 1–5 photos with real-time quality guidance |
| Anonymous consultations | Supported, with restricted clinical scope |
| Paediatric consultations | Supported with parental consent |
| Clinical AI engine | SOAP note + differential diagnosis + draft response via Claude API |
| Doctor review queue | Web dashboard for GP review, approve, amend, reject |
| Patient notification | Email delivery of doctor-approved response |
| Payments | Stripe per-consultation billing (~$50 AUD) |
| Basic follow-up | 24–48hr post-consultation email check-in |

**Phase 2+ items explicitly excluded from MVP:** native mobile app, video consultation, eScript, Medicare bulk billing, chronic condition management, EMR integration, SEA localisation.

---

## Technical Stack

| Layer | Chosen Provider | Notes |
|-------|----------------|-------|
| Hosting | AWS Sydney (ap-southeast-2) | Required for AU data residency |
| Frontend | React SPA (web, mobile-responsive) | React Native deferred to Phase 2 |
| Voice AI agent | Vapi or Retell.ai | Formal provider analysis required (see research plan) |
| Transcription | Deepgram or Azure Whisper | Evaluate in voice agent analysis |
| Clinical AI engine | Claude API (Anthropic) | SOAP, differential, draft response, red flag detection |
| Photo analysis | Claude Vision API | Bundled with Claude API |
| Doctor review queue | React web dashboard | Build in-house |
| Payments | Stripe | Per-consultation billing |
| Email notifications | SendGrid | Patient delivery of doctor response |
| SMS notifications | Twilio | Optional at MVP; email-first |
| Database | AWS RDS (PostgreSQL) | Sydney region |
| Object storage | AWS S3 (ap-southeast-2) | Encrypted photo storage |
| Auth | AWS Cognito or Auth0 | Role-based: patient / doctor / admin |

---

## Build Order & Milestones

### Pre-Build Prerequisites (Before Writing Code)

- [ ] Engage healthcare regulatory lawyer — TGA SaMD classification advice
- [ ] Engage AHPRA advertising compliance reviewer
- [ ] Confirm Medical Director (GP partner) — AHPRA-registered, clinic owner
- [ ] Confirm Medical Director's professional indemnity insurance covers AI-assisted telehealth
- [ ] Draft Privacy Policy and Collection Notice
- [ ] Register with OAIC (Office of the Australian Information Commissioner)
- [ ] Complete LLM model selection (see `research/2026-04-21-llm-model-selection.md`)
- [ ] Complete voice AI platform selection (Vapi vs Retell.ai evaluation)
- [ ] Establish clinical governance framework with Medical Director
- [ ] Design and version-control initial clinical prompt repository (question trees)

---

### Sprint 0 — Infrastructure & Auth (Week 1–2)

**Goal:** Working AWS environment, auth, and CI/CD pipeline.

| Task | Description |
|------|-------------|
| AWS account setup | ap-southeast-2 region, VPC, IAM roles |
| CI/CD pipeline | GitHub Actions → staging + prod environments |
| RDS PostgreSQL | Patient records, consultation history, audit log |
| S3 buckets | Photo storage — encrypted, separate access controls |
| Auth service | Patient / doctor / admin roles |
| Audit log table | Immutable log schema: all AI outputs + clinician actions |

**Acceptance criteria:** Can create a patient account, create a doctor account, and log actions to the immutable audit log.

---

### Sprint 1 — Patient Onboarding & Payments (Week 3–4)

**Goal:** Patient can register, complete a profile, and pay for a consultation.

| Task | Description |
|------|-------------|
| Patient registration | Name, DOB, Medicare number (optional), allergies, medications |
| Anonymous mode | Supported — no mandatory ID; restricted clinical scope flag applied |
| Paediatric flag | Parent/guardian consent capture for under-18 |
| Stripe integration | Per-consultation billing (~$50 AUD); charge on consultation start |
| Consultation booking | "New Consultation" flow; pre-payment gate |

**Acceptance criteria:** Anonymous and identified patients can book and pay for a consultation.

---

### Sprint 2 — AI Voice Agent & Transcription (Week 5–7)

**Goal:** AI can conduct a structured clinical interview via voice, with text-chat fallback.

| Task | Description |
|------|-------------|
| Voice AI integration | Integrate Vapi or Retell.ai (selected provider) |
| Audio quality check | Test connection quality at session start; fallback to text-chat if insufficient |
| Text-chat fallback | Full clinical interview via chat if voice unavailable |
| Clinical question trees | Implement first symptom categories (common presentations: URTI, UTI, skin conditions, musculoskeletal) |
| Red flag detection | Real-time emergency detection → pause + instruct patient to call 000 |
| Transcript capture | Full conversation transcript stored in database |

**Acceptance criteria:** AI can conduct a voice consultation for at least 5 common symptom presentations; red flag detection triggers 000 instruction; text fallback works end-to-end.

---

### Sprint 3 — Photo Upload (Week 7–8)

**Goal:** Patient can upload photos during consultation, with quality guidance.

| Task | Description |
|------|-------------|
| Photo upload flow | 1–5 photos per consultation |
| Real-time quality guidance | Framing, lighting, distance prompts |
| Retake prompts | Detect insufficient quality and prompt retake |
| Photo storage | AES-256 encrypted in S3 (ap-southeast-2); separate access controls |
| Photo access control | Only reviewing doctor can access a consultation's photos |

**Acceptance criteria:** Patient can upload photos with quality guidance during consultation; photos stored encrypted and accessible only to reviewing doctor.

---

### Sprint 4 — Clinical AI Engine (Week 8–10)

**Goal:** Claude API generates SOAP note, differential diagnosis, and draft patient response from consultation transcript.

| Task | Description |
|------|-------------|
| SOAP note generation | Structured Subjective/Objective/Assessment/Plan from transcript |
| Differential diagnosis | Top differentials with confidence levels |
| Draft patient response | Plain English, doctor-review-ready response |
| Red flag summary | Structured list of any concerning symptoms |
| Confidence thresholds | Define minimum confidence levels; flag low-confidence outputs for extra scrutiny |
| Output validation | Validate structure of AI output before surfacing to doctor |
| Patient history context | AI receives prior consultation history + medical profile as context |
| Anonymisation layer | Strip raw PII/health identifiers before sending to Claude API |
| Photo analysis | Claude Vision API analyses uploaded photos; output included in clinical summary |

**Acceptance criteria:** For a test consultation, Claude produces a SOAP note, differential list with confidence levels, and draft patient response; PII is not present in API payloads; anonymisation verified by inspection.

---

### Sprint 5 — Doctor Review Queue (Week 10–12)

**Goal:** GP can log into a web dashboard, review consultations, and approve/amend/reject.

| Task | Description |
|------|-------------|
| Doctor dashboard | List of pending consultations, sorted by submission time |
| Consultation detail view | Transcript, SOAP note, differentials, red flags, photos, draft response |
| Approve action | Sends AI draft to patient as-is |
| Amend action | Doctor edits draft, then approves — edited version sent |
| Reject/escalate action | Doctor writes custom response; escalation flag if urgent |
| AHPRA audit trail | Doctor's AHPRA number attached to every approved consultation |
| Immutable audit log | Every action (AI output, doctor action, patient comms) logged with timestamp |
| Email notification | SendGrid delivery to patient on doctor approval |

**Acceptance criteria:** GP can review a test consultation and approve/amend/reject; patient receives email; all actions appear in immutable audit log with AHPRA number attached.

---

### Sprint 6 — Post-Consultation Follow-Up & Beta Readiness (Week 12–14)

**Goal:** 24–48hr follow-up, end-to-end testing, and beta readiness.

| Task | Description |
|------|-------------|
| Automated follow-up | 24–48hr check-in email: "How are you feeling?" (3-option response) |
| Concerning response re-open | Concerning follow-up response re-opens ticket for doctor review |
| End-to-end testing | Full consultation flow: register → pay → AI interview → photo → doctor review → patient response → follow-up |
| Penetration testing | External security review before any real patients |
| Privacy Policy live | Collection Notice visible at registration point |
| Beta onboarding | 100 beta patients (GP's existing network) |

**Acceptance criteria:** End-to-end flow tested; pen test completed; Privacy Policy live; beta cohort onboarded.

---

## Success Metrics (Phase 1)

| Metric | Target |
|--------|--------|
| Consultations completed | 200 by Month 6 |
| AI draft approval rate (no amendment) | Baseline established |
| Patient satisfaction score | Baseline established |
| Doctor rejection rate | Baseline established |
| Average doctor review time | < 5 min per consultation |
| Average time-to-response | Tracked (no SLA committed at launch) |

---

## Infrastructure Cost Estimate (Phase 1)

| Component | Estimated Monthly Cost |
|-----------|----------------------|
| AWS RDS (db.t3.medium) | ~$80 AUD |
| AWS S3 (storage + transfer) | ~$30 AUD |
| AWS EC2 / ECS (app hosting) | ~$150 AUD |
| Claude API (~200 consultations × $2) | ~$400 AUD |
| Vapi/Retell.ai (voice) | ~$200 AUD (TBC) |
| Stripe fees (~2.9% + 30c per consult) | ~$300 AUD |
| SendGrid / Twilio | ~$50 AUD |
| **Total estimated monthly** | **~$1,200 AUD** |

*At $50/consult × 200 consults = $10,000 revenue, this represents ~12% of gross revenue in Phase 1.*

---

## Pre-Launch Compliance Checklist

From NIGHTINGALE.md §15:

- [ ] Engage healthcare regulatory lawyer (TGA SaMD classification)
- [ ] Engage AHPRA advertising compliance reviewer
- [ ] Draft Privacy Policy and Collection Notice
- [ ] Implement My Health Record opt-in consent flow
- [ ] Establish audit log architecture before first patient
- [ ] Confirm doctor partner's professional indemnity insurance covers AI-assisted telehealth
- [ ] Establish clinical governance framework (incident reporting, adverse event process, regular AI output audit)
- [ ] Register with OAIC
- [ ] Penetration test and vulnerability scan before beta launch
