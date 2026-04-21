# Project Nightingale — AI-Powered HITL Telehealth Service

> A comprehensive reference document synthesizing all business, product, technical, regulatory, and open-questions documentation for Project Nightingale.

**Codename:** Project Nightingale — named after Florence Nightingale, pioneer of evidence-based healthcare.
**Status:** Pre-build / spec complete — April 2026. All open questions answered; documents updated.

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [The Solution](#2-the-solution)
3. [Business Model](#3-business-model)
4. [Target Market](#4-target-market)
5. [Competitive Landscape](#5-competitive-landscape)
6. [Go-to-Market Strategy](#6-go-to-market-strategy)
7. [Financial Projections](#7-financial-projections)
8. [Founding Team Needs](#8-founding-team-needs)
9. [Clinical Scope & Safety Rules](#9-clinical-scope--safety-rules)
10. [Patient Experience](#10-patient-experience)
11. [Clinician Workflow](#11-clinician-workflow)
12. [Technical Architecture](#12-technical-architecture)
13. [Compliance & Data Governance](#13-compliance--data-governance)
14. [MVP Scope](#14-mvp-scope)
15. [Regulatory Guide](#15-regulatory-guide)
16. [Open Questions — Resolved](#16-open-questions--resolved)

---

## 1. Vision & Problem Statement

### Vision

> Affordable, on-demand medical consultations from a real doctor — available anytime, from anywhere. AI makes it fast. A doctor makes it safe.

### The Problem

- GP appointments in Australia take **1–2 weeks** to book
- After-hours care means expensive urgent care or ED visits
- Telehealth exists but is mostly doctor-to-patient video calls with no AI assistance — expensive to scale
- Large underserved populations in **rural Australia** and **Southeast Asia** lack local GP access

---

## 2. The Solution

A branded, AI-first telehealth service with mandatory human-in-the-loop (HITL) doctor review:

| Step | Actor | Duration |
|------|-------|----------|
| 1 | Patient consults with AI voice/video agent | 5–10 min |
| 2 | Patient uploads photos if relevant (skin, throat, wounds) | During consult |
| 3 | AI generates clinical summary + draft diagnosis + draft patient response | Automatic |
| 4 | Credentialed doctor reviews the ticket — approve, amend, or reject | 2–5 min |
| 5 | Patient receives doctor-approved advice | Typically within hours |

**Core principle:** No AI output is ever delivered to a patient without a doctor's approval gate. Patient-facing responses are always attributed to the reviewing doctor — AI involvement is not disclosed in patient communications.

---

## 3. Business Model

### Phase 1: Direct-to-Consumer (D2C)

- **Revenue:** Per-consultation fee (~$40–$60 AUD)
- Paid by patient at time of booking (via Stripe)
- Doctor partner receives a **revenue share per approved consultation**
- No Medicare bulk billing initially (avoids regulatory complexity)
- Optional private health insurance integration later

### Phase 2: Platform SaaS (Clinic White-Label)

- Sell the platform to clinics as a white-label SaaS tool
- Per-consultation fee paid by clinic
- Clinics use it to extend capacity, offer after-hours, reduce admin burden
- Pursued only after Model 2 (D2C) reaches sustainable scale

---

## 4. Target Market

### Primary: Australia

| Factor | Detail |
|--------|--------|
| Population | 26M, high smartphone penetration |
| Telehealth adoption | Strong post-COVID consumer familiarity |
| Regulation | Navigable (TGA, AHPRA, Privacy Act) |
| Medicare pathway | Available for Phase 2 (requires video + provider number) |

### Expansion: Southeast Asia (Year 2)

| Market | Entry Rationale |
|--------|----------------|
| Singapore | English-speaking, tech-savvy, lighter regulation |
| Malaysia | English-speaking, large underserved population |
| Price point | ~$15–25 USD per consult (lower than Australia) |
| Indonesia / Philippines / Thailand | Later — more complex regulatory environment |

---

## 5. Competitive Landscape

| Competitor | Model | Weakness vs. Nightingale |
|------------|-------|--------------------------|
| Eucalyptus (Pilot, Juniper) | Condition-specific telehealth | Narrow scope, no AI consult agent |
| HotDoc | Appointment booking | No consultation AI |
| Instant Scripts | Script-only, no consult | Very limited scope |
| Babylon Health (UK) | AI + GP — closest competitor | Not available in Australia |
| Your.MD / Ada Health | Symptom checker only | No HITL, no prescription capability |

**Nightingale's differentiated edge:**
- Full consultation AI (voice/video/photo) — not just a symptom checker
- Mandatory HITL (doctor review and approval on every consultation)
- Branded doctor face — patient trust through human accountability
- D2C distribution — no clinic partnership required to use

---

## 6. Go-to-Market Strategy

### Phase 1 — Validate (Months 1–6)

- Recruit **1 GP partner** (becomes Medical Director)
- Build MVP: AI voice agent + photo upload + doctor review queue + patient web app
- Soft launch to **100 beta patients** (friends, family, GP's existing patients)
- **Success metrics:** 200 consultations completed; measure AI draft approval rate, patient satisfaction, time-to-response

### Phase 2 — Grow D2C (Months 7–12)

- **SEO content marketing:** target "online doctor Australia", "telehealth GP" keywords
- **Google Ads:** target after-hours search intent
- **Social media:** doctor partner creates educational health content (Instagram, TikTok, YouTube)
- **Target:** 1,000 consultations/month, $40–60k MRR

### Phase 3 — Scale & Expand (Year 2)

- Scale D2C by recruiting additional doctors on the ground to increase consultation capacity
- Explore Medicare telehealth billing integration (requires video + provider number)
- SEA expansion — Singapore pilot
- Platform licensing (Model 1) evaluated only after Model 2 reaches sustainable scale

---

## 7. Financial Projections

| Metric | Month 6 | Month 12 | Year 2 |
|--------|---------|----------|--------|
| Monthly consultations | 200 | 1,000 | 5,000 |
| Price per consult (AUD) | $50 | $50 | $50 |
| Gross revenue (monthly) | $10,000 | $50,000 | $250,000 |
| Doctor rev share (30%) | -$3,000 | -$15,000 | -$75,000 |
| AI/infra cost (~$2/consult) | -$400 | -$2,000 | -$10,000 |
| **Net contribution** | **~$6,600** | **~$33,000** | **~$165,000** |

*These are indicative projections for planning purposes.*

---

## 8. Founding Team Needs

| Role | Requirements |
|------|-------------|
| Technical co-founder / CTO | AI/ML experience; healthcare systems experience preferred |
| Medical Director (doctor partner) | AHPRA-registered GP generalist, ideally a clinic owner; equity + rev share arrangement |
| Regulatory advisor | TGA SaMD classification; AHPRA advertising compliance |
| Clinical advisor | Validates AI clinical logic and question trees |

---

## 9. Clinical Scope & Safety Rules

### Conditions in Scope

**All presenting complaints are in scope for AI assessment.** The AI operates as a generalist — no condition type is excluded at triage.

### Mandatory Escalation Rules

The following **always** trigger immediate escalation, regardless of apparent severity:

1. Physical examination is required to assess the condition
2. Any emergency or life-threatening presentation

In these cases, the AI instructs the patient to call **000 (triple zero)** or seek immediate in-person care. This happens during the consultation — it does not wait for doctor review.

### Doctor Rejection → In-Person Referral

When the reviewing doctor cannot complete a remote assessment:
- The consultation is **not charged**
- The patient is referred to the nearest in-person clinic (Medical Director's own clinic at launch, where geographically possible; otherwise, nearest available clinic)

### Paediatric Consultations

- Children under 18 are **supported** in Phase 1
- Parental or guardian supervision and consent required at time of consultation

### Anonymous Usage

- Supported — anonymous patients receive **clinically restricted advice**
- Minimum-friction approach — no mandatory ID at registration
- Medicare number + DOB is optional for identified patients

---

## 10. Patient Experience

### Onboarding (~3 minutes)

- Name, date of birth, Medicare number (optional), allergies, conditions, medications
- Paediatric patients: parental consent captured at time of consultation
- Identity verification: Medicare number + DOB optional; anonymous usage supported with restricted clinical scope

### Starting a Consultation

1. Patient selects "New Consultation"
2. Types or speaks reason for visit (free text or voice)
3. Chooses: **Voice call** or **Video call**
4. Pays consultation fee via Stripe (~$50 AUD)

### AI Consultation (5–10 min)

- AI voice/video agent conducts structured clinical interview
- Follows **symptom-specific question trees** (differential diagnosis logic)
- Question trees stored in a version-controlled clinical prompt repository
- **Medical Director holds clinical authority** over all prompt changes
- AI has access to the patient's **prior consultation history and medical profile** to improve accuracy
- **Audio quality check** at session start — falls back to text-based chat if connection speed is insufficient
- Asks follow-up questions dynamically based on responses
- Prompts patient to upload photos where relevant; provides **real-time guidance** on framing, lighting, and distance; prompts retake if quality is insufficient
- **Red flag detection:** if an emergency symptom is identified, the consultation pauses and the patient is instructed to call 000 immediately
- Ends with: *"A doctor will review your consultation and respond shortly"* (no SLA committed at launch; 2-minute response target at scale)

### Doctor Response (delivered to patient)

- Delivered via **app notification + email**
- Written in plain English
- Includes: assessment, recommended next steps, red flags to watch for
- If prescription warranted: **eScript** delivered via Fred Dispense / ScriptPad
- If escalation needed: clear direction to ED, urgent care, or specialist — or 000 for life-threatening presentations
- If doctor rejects: patient notified, consultation not charged, referred to nearest in-person clinic

### Post-Consultation Follow-Up (Phase 1.5)

- Automated check-in **24–48 hours** after consultation
- Simple 3-option "How are you feeling?" response
- Concerning responses **re-open a follow-up ticket** for doctor review

---

## 11. Clinician Workflow

### Doctor Review Queue — Ticket Contents

| Field | Description |
|-------|-------------|
| Patient | Name, age, sex, relevant medical history |
| Reason | Chief complaint as stated by patient |
| Transcript | Full AI conversation transcript |
| SOAP Note | AI-generated Subjective/Objective/Assessment/Plan |
| AI Diagnosis | Top differential diagnoses with confidence levels |
| Red Flags | Any concerning symptoms flagged by AI |
| Photos | Attached images (if any) |
| Draft Response | AI-generated patient-facing response in plain English |
| Actions | Approve / Amend / Reject + Escalate |

### Doctor Actions

| Action | Outcome |
|--------|---------|
| **Approve** | AI draft sent to patient as-is |
| **Amend** | Doctor edits the draft, then approves — edited version sent to patient |
| **Reject / Escalate** | Doctor writes custom response; flags for urgent care if needed |

### Audit Trail

- Every AI output, doctor action, and patient communication is logged with timestamp
- **Immutable audit log** for medicolegal compliance
- Doctor's **AHPRA number** attached to every approved consultation

---

## 12. Technical Architecture

### Component Stack

| Layer | Component | Provider |
|-------|-----------|----------|
| Patient web app | React SPA + React Native mobile | Build (in-house) |
| Voice AI agent | Real-time voice conversation | Vapi or Retell.ai *(formal provider analysis required — evaluate latency, accuracy, cost, healthcare compliance before selection)* |
| Video | WebRTC video consultation | Daily.co or Twilio Video |
| Transcription | Real-time speech-to-text | Deepgram or Azure Whisper |
| Clinical AI engine | SOAP note + differential diagnosis + draft response | Claude API (Anthropic) |
| Photo analysis | Medical image interpretation | Claude Vision API |
| Clinical prompt repository | Version-controlled question trees + system prompts | Build (Medical Director governs all changes) |
| Doctor review queue | Web dashboard | Build (React) |
| eScript | Electronic prescription issuance | Fred Dispense API / ScriptPad |
| Payments | Per-consultation billing | Stripe |
| Notifications | SMS + email delivery | Twilio + SendGrid |
| Infrastructure | Hosting + storage | AWS Sydney (ap-southeast-2) |

### Data Flow

```
Patient (voice/video/photo)
  → Voice AI Agent (Vapi/Retell)
  → Transcription (Deepgram)
  → Clinical AI Engine (Claude API)
      → SOAP note
      → Differential diagnosis (with confidence levels)
      → Draft patient response
      → Red flag detection
  → Doctor Review Queue
      → Approve / Amend / Reject
  → Patient notification (Twilio/SendGrid)
  → (Optional) eScript issued (Fred Dispense)
  → 48hr follow-up trigger (automated)
```

---

## 13. Compliance & Data Governance

### Data Sovereignty

- All data stored in **AWS Sydney (ap-southeast-2)** — full Australian data residency
- All patient records retained in Australia for a minimum of **7 years** (legal requirement)

### Encryption

- **AES-256** encryption at rest
- **TLS 1.3** in transit
- Photos encrypted and stored alongside patient data with **separate access controls**

### AI Privacy Architecture

- Patient data **anonymised before being sent to external LLM APIs** — no raw PII or health identifiers transmitted to AI providers
- Consultation data **not used to train third-party LLM models** — proprietary dataset retained to build internal intelligence moat

### AI Safety & Guardrails

- Confidence thresholds on all AI clinical outputs
- Output validation before surfacing to doctor
- Mandatory human review checkpoint on every consultation — no AI output ever reaches the patient without doctor gate
- Patient-facing responses always attributed to reviewing doctor; AI involvement not disclosed
- Specific guardrail design to be confirmed with clinical advisor pre-launch

### Access Control & Security

- Role-based access control: **patient / doctor / admin**
- Regular penetration testing + vulnerability scanning
- Immutable audit log on all AI outputs and clinician actions

### AHPRA Advertising Constraints

- Cannot claim to "diagnose" or "cure" — use **"assess"** and **"recommend"**
- Cannot use testimonials that include clinical outcomes
- Must include standard disclaimers (not a substitute for in-person care; emergency disclaimer)
- Full advertising compliance approach to be confirmed with AHPRA specialist before marketing launch

---

## 14. MVP Scope

### Phase 1 — In Scope

- Patient web app (mobile-responsive; no native app yet)
- Voice consultation (AI agent via Vapi/Retell) with **text-chat fallback** for poor connections
- Photo upload (1–5 photos per consultation) with real-time quality guidance and retake prompts
- Anonymous consultations (with restricted clinical scope for unidentified patients)
- Paediatric consultations (under 18 with parental supervision)
- Clinical AI engine (SOAP + differential + draft response) with access to patient history
- Doctor review queue (web dashboard)
- Patient notification (email)
- Stripe payments
- Basic post-consultation follow-up (email-based)

### Phase 2+ — Out of Scope at Launch

- Native mobile app
- Video consultation
- eScript integration
- Medicare bulk billing
- Chronic condition management
- Proactive outreach campaigns
- EMR integration
- SEA localisation

---

## 15. Regulatory Guide

### Australia — AHPRA

- Doctor partner must hold current **AHPRA registration** (GP — generalist)
- Doctor partner acts as **Medical Director** — legally responsible for all clinical decisions
- As the approving clinician on each consultation, **they bear professional liability** for clinical outcomes
- Platform liability limited to technology provision; clinical liability sits with the Medical Director

**Advertising rules:**
- Use "assess" and "recommend" — never "diagnose" or "cure"
- No testimonials that reference clinical outcomes
- Must include: "not a substitute for in-person care" and emergency disclaimers
- Full compliance approach to be confirmed with an AHPRA specialist before marketing launch

### Australia — TGA (Therapeutic Goods Administration)

- AI clinical decision support software may be classified as **Software as a Medical Device (SaMD)**
- Key question: Is AI output "diagnosis" or "clinical decision support" reviewed by a human?
- **HITL architecture is critical** — keeps the product in the decision support category, not autonomous diagnostic software
- TGA Digital Health guidance: software that aids clinical decision-making by a healthcare professional is lower risk than autonomous diagnostic software
- **Recommended path:** Register as **Class IIa SaMD** (clinical decision support) — requires conformity assessment but lower bar than Class IIb/III
- **TGA approval is likely required before launch** — engage TGA early and obtain a formal legal opinion on SaMD classification pathway

### Australia — Privacy Act & Australian Privacy Principles (APPs)

- Health information is **"sensitive information"** under the Privacy Act 1988
- Must have a **Privacy Policy** and **Collection Notice** at point of data collection
- Patients must consent to collection and use of health data
- **My Health Record Act** — consider whether to integrate (opt-in)
- **Mandatory data breach notification** under the Notifiable Data Breaches (NDB) scheme
- Health records retained for minimum **7 years** under applicable laws
- Patient data anonymised before external LLM API calls — aligns with APP 11 security obligations
- Consultation data not used to train third-party LLMs

### Australia — Telehealth Specifics

- Medicare telehealth item numbers require **video** (not voice-only) for billing — not relevant for Phase 1
- Medicare bulk billing requires a provider number — relevant for Phase 2

### Clinical Governance (Required Before Launch)

Minimum viable clinical governance structure:

- **Medical Director** (doctor partner) as clinical authority for all AI prompt changes and clinical protocols
- **Incident reporting process** for adverse events and near-misses
- Regular **audit** of AI output quality, doctor rejection rates, and amendment rates
- Clear escalation pathway: non-emergency remote limit → in-person referral (no charge); emergency → 000
- Full governance board structure to be proposed and agreed with the Medical Director pre-launch
- Doctor partner's professional indemnity insurance must explicitly cover AI-assisted telehealth consultations — confirm scope with insurer before launch

### Southeast Asia — Singapore (Year 2)

- **HSA** (Health Sciences Authority) regulates medical devices including SaMD
- Telemedicine guidelines from Ministry of Health — doctor must be Singapore-licensed
- **PDPA** (Personal Data Protection Act) governs health data
- Strategy: partner with a Singapore-registered doctor for HITL compliance

### Southeast Asia — Malaysia (Year 2)

- **MDA** (Medical Device Authority) regulates SaMD
- Malaysian Medical Council telemedicine guidelines apply
- **PDPA Malaysia** applies
- Strategy: local doctor partnership model (same as Australia)

### Pre-Launch Compliance Checklist

- [ ] Engage healthcare regulatory lawyer (TGA SaMD classification advice)
- [ ] Engage AHPRA advertising compliance reviewer
- [ ] Draft Privacy Policy and Collection Notice
- [ ] Implement My Health Record opt-in consent flow
- [ ] Establish audit log architecture before first patient
- [ ] Confirm doctor partner's professional indemnity insurance explicitly covers AI-assisted telehealth
- [ ] Establish clinical governance framework (incident reporting, adverse event process, regular AI output audit, Medical Director as clinical authority)
- [ ] Register with the Office of the Australian Information Commissioner (OAIC)

---

## 16. Open Questions — Resolved

All key pre-build questions have been answered. Answers are incorporated into the specs above. The questions and their resolutions are preserved here for traceability.

### Clinical & Safety

| # | Question | Resolution |
|---|----------|-----------|
| 1 | What conditions are in scope? | All presenting complaints — the AI operates as a generalist. No conditions excluded at triage. |
| 2 | Escalation protocol for red flag symptoms? | Direct to 000 for emergencies; patient instructed immediately during the consultation, not after doctor review. |
| 3 | How is AI accuracy validated? | Doctor review and approval on every consultation is the primary validation mechanism at launch. |
| 4 | What happens when the doctor rejects? | Consultation not charged. Refer to nearest in-person clinic (Medical Director's clinic at launch where geographically possible). |
| 5 | Liability for adverse events? | Clinical liability sits with the doctor (Medical Director) as the approving clinician. Platform liability limited to technology provision. |
| 6 | Conditions requiring mandatory in-person referral? | Physical examination required, or any emergency / life-threatening presentation → 000 or in-person. |

### Regulatory & Legal

| # | Question | Resolution |
|---|----------|-----------|
| 7 | TGA classification pathway? | TGA approval likely required. Pursue Class IIa SaMD (clinical decision support). HITL architecture is key to staying below Class IIb/III. |
| 8 | AHPRA advertising constraints? | Cannot claim "diagnose/cure"; no outcome testimonials; standard disclaimers required. Confirm with AHPRA specialist before marketing launch. |
| 9 | Does AI differential diagnosis constitute "practising medicine"? | Managed by HITL: all AI output is "draft for doctor review" — never delivered to patient autonomously. Patient messaging never references AI. |
| 10 | Doctor partner's legal exposure? | AHPRA registration covers AI-assisted telehealth if professional indemnity insurance explicitly covers it — confirm scope with insurer before launch. |
| 11 | Clinical governance board required before launch? | Yes — minimum viable structure: Medical Director as authority, incident reporting, AI output audit. Full governance board to be designed pre-launch with Medical Director. |

### Product & UX

| # | Question | Resolution |
|---|----------|-----------|
| 12 | Response time SLA? | No SLA committed at launch. Target: 2-minute response at scale. Initial response time governed by doctor availability. |
| 13 | Paediatric consultations? | Supported in Phase 1 with parental/guardian supervision and consent. |
| 14 | Repeat patients and history access? | AI has access to prior consultation history and medical profile to improve assessment accuracy. |
| 15 | Identity verification? | Anonymous usage supported (with restricted clinical advice). Medicare + DOB optional. Minimum-friction approach — no mandatory ID at registration. |
| 16 | Photo upload UX? | Real-time quality guidance (framing, lighting, distance) during the consultation. Prompts to retake if quality is insufficient. |

### Business & Commercial

| # | Question | Resolution |
|---|----------|-----------|
| 17 | Ideal doctor partner? | GP generalist who is a clinic owner. Equity + revenue share arrangement. |
| 18 | Patient acquisition cost (CAC)? | Requires research into CAC for telehealth via Google Ads and SEO in Australia. |
| 19 | Price sensitivity at $50/consult? | Cost per consult model confirmed. Subscription option to be explored later. |
| 20 | Doctor time commitment per ticket? | 2–5 minutes per review is reasonable. Second doctor threshold to be determined by consultation volume. |
| 21 | When to pursue Model 1 (clinic SaaS)? | Only after Model 2 (D2C) is at sustainable scale — scale D2C first by recruiting more doctors on the ground. |
| 22 | SEA pricing strategy? | Local currency pricing, lower absolute fee. Unit economics to be modelled per-market. |

### Technical

| # | Question | Resolution |
|---|----------|-----------|
| 23 | Voice AI platform: Vapi or Retell.ai? | Formal provider analysis required before selection — evaluate latency, accuracy, cost, and healthcare compliance (HIPAA/IRAP equivalent). |
| 24 | Poor audio quality in rural areas? | Text-based chat fallback. Audio quality check at session start; fall back to chat if connection speed is insufficient (optional speed test). |
| 25 | Clinical AI prompt architecture? | Symptom-specific question trees in a version-controlled clinical prompt repository. Medical Director holds clinical authority over all changes. |
| 26 | AI hallucination prevention? | Confidence thresholds, output validation, mandatory doctor review checkpoint on all outputs. Specific guardrail design to be confirmed with clinical advisor. |
| 27 | Data retention policy? | All data retained in Australia. Minimum 7 years (medicolegal requirement). Data anonymised when sent to external LLM APIs. Not used to train third-party LLMs — proprietary dataset retained for internal intelligence. |
| 28 | Photo pipeline security? | Photos encrypted at rest (AES-256), stored alongside patient data with separate access controls, transmitted via TLS 1.3. |
