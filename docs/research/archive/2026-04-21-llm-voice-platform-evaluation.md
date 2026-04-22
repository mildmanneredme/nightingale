# RESEARCH-002 — LLM & Voice Platform Evaluation

> **Status:** Complete — decisions recorded 2026-04-21 and archived
> **Document type:** Research / evaluation — no code deliverables; decisions recorded in [ROADMAP.md](../../backlog/ROADMAP.md)
> **Owner:** CTO + Medical Director

---

## Overview

Before Sprint 2 (AI Voice Consultation) and Sprint 4 (Clinical AI Engine) can begin, the underlying platform and model choices must be settled. This PRD tracks the formal evaluation of two independent but related decisions:

1. **Voice AI platform** (Vapi vs Retell.ai) — decision gates Sprint 2
2. **Clinical LLM** (Claude via AWS Bedrock, GPT-4o, Gemini, Llama 3) — decision gates Sprint 4

Both evaluations use structured, evidence-based scoring methods with Medical Director sign-off. They are not best-guess decisions made at sprint start.

---

## Background

General-purpose LLMs carry real clinical risk: hallucinated drug names, incorrect dosages, and misquoted contraindications can mislead a reviewing GP. A busy doctor may miss a confidently-stated error in an otherwise well-structured SOAP note. The HITL architecture mitigates but does not eliminate this risk — model selection is a clinical safety decision, not merely a technical preference.

The voice platform choice similarly has regulatory implications: real-time audio of a medical consultation is sensitive health information under the Privacy Act. Any voice platform that processes or retains audio without Australian data residency guarantees triggers APP 8 obligations.

---

## Part 1 — Voice Platform Evaluation

> **Decision recorded:** 2026-04-21 | **Decision: Gemini 2.5 Flash Live API (direct integration) — Retell.ai held as fallback**

### Architecture Decision: Direct Gemini Live API vs Third-Party Voice Platform

After completing the Vapi vs Retell.ai scorecard, a revised architecture was evaluated: replacing the voice platform layer entirely with **Google Gemini 2.5 Flash Live API** (native real-time audio), while routing post-consultation processing to Claude Sonnet 4.6 on Bedrock. This hybrid is now the preferred path.

```
Patient audio (WebSocket)
        ↓
Gemini 2.5 Flash Live API (GCP australia-southeast1)
  — conducts structured clinical interview
  — follows question trees injected as system prompt
  — real-time native audio-in / audio-out (no ASR→LLM→TTS chain)
        ↓ (session end: full transcript extracted)
Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2
  — SOAP note generation
  — differential diagnosis
  — patient-facing draft response
        ↓
Doctor review dashboard
```

### Why Gemini Live API Over Vapi / Retell.ai

| Factor | Vapi | Retell.ai | Gemini Live API |
|--------|------|-----------|-----------------|
| Latency mechanism | ASR → LLM → TTS chain: 3–7s real-world | ASR → LLM → TTS: ~700–800ms | Native audio-in/out: target <500ms |
| Voice cost at 200 consults/month | ~$1,659 AUD ($1,000 HIPAA flat fee dominates) | ~$184 AUD | ~$4.80 AUD |
| Voice cost at 1,000 consults/month | ~$2,093 AUD | ~$920 AUD | ~$24 AUD |
| AU data residency | Unconfirmed — vendor inquiry required | Unconfirmed — on-premise SIP option | GCP australia-southeast1 — **must confirm Live API availability in that region** |
| HIPAA / compliance | $1,000/month surcharge | SOC 2 Type II; BAA on enterprise MSA | GCP DPA; ISO 27001; HIPAA eligible |
| Engineering overhead | Low (managed platform) | Low (managed platform) | **High — custom WebSocket integration required** |
| Third-party dependency | Yes | Yes | No — direct Google API |

### Pricing: Gemini 2.5 Flash Live API

Token billing: text at $0.30/M input, $2.50/M output; audio billed at 25 tokens/second (Vertex AI Live API, April 2026).

**Per 7-minute consultation:**

| Component | Calculation | Cost (USD) |
|-----------|-------------|------------|
| Patient audio input (~3.5 min) | 3.5 × 60 × 25 = 5,250 tokens @ $0.30/M | $0.0016 |
| Gemini audio output (~3.5 min) | 3.5 × 60 × 25 = 5,250 tokens @ $2.50/M | $0.0131 |
| Text (system prompt + question trees) | ~1,500 tokens @ $0.30/M | $0.0005 |
| **Voice subtotal** | | **$0.0152 USD ≈ $0.024 AUD** |

| Volume | Gemini Live | Claude Sonnet 4.6 (backend) | Total AI cost (AUD) |
|--------|-------------|------------------------------|---------------------|
| 200 consults/month | $4.80 | $8.40 | **$13.20** |
| 1,000 consults/month | $24.00 | $42.00 | **$66.00** |

The combined Gemini Live + Claude Sonnet 4.6 stack is **~15× cheaper than Retell + Claude** on a per-consultation basis at target volumes. All in well within the $2 AUD/consult target.

### Retell.ai Scorecard (Retained for Reference / Fallback)

Original scorecard completed for Vapi vs Retell.ai, retained here as the fallback option if Gemini Live API cannot be confirmed for `australia-southeast1`.

| Criterion | Weight | Vapi | Retell.ai |
|-----------|--------|------|-----------|
| Real-time latency | 30% | 2.5 | 3.5 |
| Australian accent accuracy | 25% | 3.5 | 3.5 |
| Healthcare vocabulary | 20% | 3.5 | 3.5 |
| AU data residency / compliance | 15% | 2.5 | 3.5 |
| SDK / webhook reliability | 5% | 3.5 | 4.0 |
| Pricing model | 5% | 1.5 | 4.5 |
| **Weighted total** | | **2.95 / 5** | **3.58 / 5** |

Retell.ai is the fallback: $0.055/min voice + $0.015/min TTS + $0.015/min telephony = $0.085/min with custom LLM = ~$0.92 AUD/consult. HIPAA BAA on enterprise MSA; SOC 2 Type II confirmed.

### Deliverables Status

- [x] Vapi vs Retell.ai scored against weighted criteria
- [x] Gemini Live API architecture evaluated; cost comparison complete
- [x] Pricing calculated at 200 and 1,000 consultations/month for all options
- [x] Compliance posture assessed for all candidates
- [ ] **Gemini Live API availability confirmed for GCP `australia-southeast1`** — primary blocker; contact Google Cloud before Sprint 2 start
- [ ] GCP DPA reviewed for Gemini Live API; AU data residency terms confirmed or on-premise path arranged
- [ ] Gemini Live API latency and Australian accent accuracy validated on AU network endpoint
- [ ] Healthcare vocabulary accuracy tested against 30-term medical word list
- [ ] If GCP residency unconfirmable: Retell.ai DPA executed as fallback before Sprint 2 start

---

## Part 2 — Clinical LLM Evaluation

> **Decision recorded:** 2026-04-21 | **Decision: Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2**

### Candidates (Updated to April 2026 model versions)

| Model | Provider | Data Residency Option | Notes |
|-------|----------|-----------------------|-------|
| **Claude Sonnet 4.6** | Anthropic via AWS Bedrock | ap-southeast-2 (Sydney) — **confirmed** | Current production Sonnet; escalation path to Opus 4.7 for complex cases |
| **GPT-4o** | OpenAI via Azure Australia East | Australia East — available | Standard Azure DPA applies |
| **Gemini 2.5 Flash** | Google via GCP Vertex AI | australia-southeast1 (Sydney) — available | Gemini 2.0 Flash EOL for new projects Mar 2026; 2.5 Flash recommended |
| **Llama 3 70B** | Meta (open source) | Self-hosted on AWS ap-southeast-2 | Full data sovereignty; significant operational overhead |

### Evaluation Criteria Scoring

| Criterion | Weight | Claude Sonnet 4.6 | GPT-4o | Gemini 2.5 Flash | Llama 3 70B |
|-----------|--------|:-----------------:|:------:|:----------------:|:-----------:|
| Medical reasoning accuracy | 30% | **4.5** | **4.0** | **3.5** | **3.0** |
| Hallucination rate in medical context | 25% | **4.5** | **3.5** | **4.0** | **3.0** |
| Clinical note quality | 20% | **4.5** | **3.5** | **3.5** | **2.5** |
| Multimodal imaging capability | 10% | **4.0** | **4.0** | **3.5** | **2.0** |
| Australian data sovereignty & DPA | 10% | **5.0** | **4.0** | **4.0** | **5.0** |
| Cost per consultation | 5% | **4.5** | **4.5** | **5.0** | **1.5** |
| Latency & reliability | 5% | **4.0** | **4.0** | **4.5** | **3.0** |
| **Weighted total** | | **4.70 / 5** | **4.00 / 5** | **3.98 / 5** | **3.08 / 5** |

### Scoring Rationale by Criterion

#### 1. Medical Reasoning Accuracy (30%)

| Model | MedQA Score | Source | Score |
|-------|-------------|--------|-------|
| Claude Sonnet 4.6 (with thinking) | 92.3% | pricepertoken.com MedQA leaderboard, April 2026 | **4.5** |
| GPT-4o | ~90.9% (with CoT) | MedHallu / published studies 2024–2025 | **4.0** |
| Gemini 2.5 Flash | ~88% (estimated; 2.0 Flash scored 83.2%) | pricepertoken.com leaderboard | **3.5** |
| Llama 3 70B (base) | ~75–80% | Published comparisons; slightly below GPT-4o base | **3.0** |

Context: Gemini 2.5 Pro reaches 94.6% and o4 Mini reaches 95.2% but neither is appropriate here — Pro is 10× the cost of Flash, and o4 Mini is OpenAI-only with no confirmed AU data residency. For reference, typical USMLE human pass threshold is ~60%; all candidates substantially exceed it.

#### 2. Hallucination Rate in Medical Context (25%)

| Model | Evidence | Score |
|-------|----------|-------|
| Claude Sonnet 4.6 | Strong factuality record; thinking mode adds explicit reasoning chain that reduces confident hallucination. Best clinical safety profile among candidates. | **4.5** |
| GPT-4o | Published study (PMC11074889): ChatGPT-4 SOAP notes averaged 23.6 errors/case, 3.2% incorrect facts (omissions dominate at 86%). Moderate risk of confident errors on drug dosages. | **3.5** |
| Gemini 2.5 Flash | High baseline hallucination resistance on Med-HALT per 2025 research; Flash models rate well. Slightly less tested than Claude/GPT-4o on clinical tasks. | **4.0** |
| Llama 3 70B | Less medical RLHF than API models; higher hallucination risk without fine-tuning. Medical fine-tunes (Med42, Meditron) improve this but add deployment complexity. | **3.0** |

Note: No model currently meets the <2% trap-test hallucination threshold on drug interactions without specific medical fine-tuning. The 20-question hallucination trap test specified in this PRD must still be run against the chosen model before Sprint 4 start.

#### 3. Clinical Note Quality (20%)

| Model | Evidence | Score |
|-------|----------|-------|
| Claude Sonnet 4.6 | Highest marks in independent long-context structured reasoning evaluations. Excels at following complex system-prompt formatting constraints (critical for SOAP + differential + patient-facing triple output). MedHELM (2025) rates Claude as providing strong cost-performance balance on clinical tasks. | **4.5** |
| GPT-4o | 23.6 average errors per clinical case in SOAP study, primarily errors of omission (86%). Will miss clinical detail if transcript is dense. | **3.5** |
| Gemini 2.5 Flash | Flash models prioritise speed over depth; comparable to GPT-4o on structured outputs. No published AU GP consultation SOAP evaluation. | **3.5** |
| Llama 3 70B | Without medical fine-tuning, SOAP structure adherence and clinical completeness are inconsistent. | **2.5** |

The blind Medical Director evaluation of 10 synthetic AU GP consultation outputs is still required before Sprint 4 start.

#### 4. Multimodal Medical Imaging (10%)

| Model | Evidence | Score |
|-------|----------|-------|
| Claude Sonnet 4.6 | Multimodal capable; strong visual reasoning. No published AU dermatology benchmark but comparable to GPT-4o performance in independent evals. | **4.0** |
| GPT-4o | Best-tested multimodal: 67.8% accuracy on 500 dermatological images (psoriasis/vitiligo/erysipelas/rosacea); 88.3% on clinical cases with images. Outperforms specialists in image+text combined evaluations. | **4.0** |
| Gemini 2.5 Flash | Multimodal capable; Flash version not extensively benchmarked on medical imaging vs Pro. | **3.5** |
| Llama 3 70B | Text-only by default; vision-language variants (LLaVA-based) are less mature for clinical imaging. Disqualified from photo analysis without a separate specialist model. | **2.0** |

#### 5. Australian Data Sovereignty & DPA (10%)

| Model | Status | Score |
|-------|--------|-------|
| Claude Sonnet 4.6 via Bedrock | **Confirmed**: AWS Bedrock available in ap-southeast-2. Geographic cross-region inference routes Sydney ↔ Melbourne only — data never leaves AU. AWS DPA covers Bedrock. Bedrock confirmed opt-out of model training. SOC 2 Type II, ISO 27001, HIPAA. **This is the primary infrastructure decision already confirmed in ROADMAP.md.** | **5.0** |
| GPT-4o via Azure AU East | Azure Australia East available. "Global Standard" deployment mode may process prompts outside AU; regional PTU deployment locks to AU East. Microsoft DPA applies; BAA available. In-country AU processing offered by end of 2025 per Microsoft announcement. | **4.0** |
| Gemini 2.5 Flash via GCP | australia-southeast1 available on Vertex AI. Google DPA and standard enterprise compliance. SOC 2, ISO 27001, HIPAA certified. Fine-tuning operations may have temporary data relocation risk — confirm with vendor. | **4.0** |
| Llama 3 70B self-hosted | Complete data sovereignty: data never leaves AWS ap-southeast-2. No third-party DPA required. Ideal for sovereignty but data moat strategy and medical fine-tuning data also self-managed. | **5.0** |

#### 6. Cost Per Consultation (5%)

Token assumptions: 2,000 transcript + 1,500 system prompt + 500 history + 300 image description = **4,300 input tokens**; 800 output tokens.

Pricing as at April 2026 (USD → AUD at 1.55):

| Model | Input (per 1M) | Output (per 1M) | Per consult (USD) | Per consult (AUD) | 200/mo (AUD) | 1,000/mo (AUD) | Score |
|-------|---------------|-----------------|-------------------|-------------------|--------------|----------------|-------|
| Claude Sonnet 4.6 (Bedrock ap-se-2, +10% regional) | $3.30 | $16.50 | $0.028 | $0.043 | $8.60 | $43 | **4.5** |
| GPT-4o (Azure, global pricing) | $2.50 | $10.00 | $0.019 | $0.029 | $5.80 | $29 | **4.5** |
| Gemini 2.5 Flash (Vertex AI) | $0.30 | $2.50 | $0.003 | $0.005 | $1.00 | $5 | **5.0** |
| Llama 3 70B (g5.12xlarge reserved, ap-se-2, ~$5/hr effective) | — | — | — | ~$18 (200/mo) | ~$3,600 | ~$3,600 | **1.5** |

All API models are well within the $2 AUD/consult target. Llama self-hosted requires >5,000 consults/month to be cost-competitive with API options.

#### 7. Latency & Reliability (5%)

| Model | Assessment | Score |
|-------|------------|-------|
| Claude Sonnet 4.6 via Bedrock | AWS backbone; streaming supported; SLA-backed; P50 estimated 10–15s for 5K token payload. Well within 30s target. | **4.0** |
| GPT-4o via Azure | Azure SLA; streaming supported; comparable latency to Bedrock. | **4.0** |
| Gemini 2.5 Flash | Flash architecture optimised for speed; typically fastest of the three. Google global CDN. | **4.5** |
| Llama 3 70B self-hosted | Latency depends on instance type and configuration; requires operational engineering to achieve consistent P95. | **3.0** |

### Deliverables Status

- [x] Benchmark literature review completed (MedQA, Med-HALT, ClinicalBench published scores)
- [x] Data sovereignty compliance check completed for each provider
- [x] Cost modelling at 200 and 1,000 consultations/month
- [x] Latency assessment completed; streaming support confirmed
- [x] Completed scoring matrix produced
- [ ] 20-question hallucination trap test run against Claude Sonnet 4.6 — **required before Sprint 4 start**
- [ ] 10 synthetic AU GP consultation transcripts submitted to Claude Sonnet 4.6 — **required before Sprint 4 start**
- [ ] Medical Director blind evaluation of SOAP outputs completed — **required before Sprint 4 start**
- [ ] 20 clinical image samples submitted; photo analysis accuracy scored — **required before Sprint 4 start**
- [ ] Written recommendation with Medical Director sign-off — **pending Medical Director engagement (PRD-001 dependency)**

---

## Acceptance Criteria

- [x] Voice platform recommendation documented with scoring rationale
- [x] Clinical LLM recommendation documented with scoring matrix filled in; winning model identified
- [ ] Hallucination rate for chosen LLM < 2% on trap test — **to be confirmed**
- [ ] DPA confirmed with Retell.ai for AU data residency — **to be actioned**
- [ ] Both decisions recorded in ROADMAP.md Key Open Decisions table — **to be actioned**

---

## Research Timeline

| Task | Owner | Deadline | Status |
|------|-------|----------|--------|
| Voice platform: compliance posture and pricing assessment | CTO | Week 3 | **Complete** |
| Voice platform: recommendation | CTO | Week 4 | **Complete — Retell.ai** |
| LLM: benchmark literature review (MedQA, Med-HALT) | CTO | Week 2 | **Complete** |
| LLM: data sovereignty compliance check per provider | CTO | Week 4 | **Complete** |
| LLM: cost modelling + latency benchmarking | CTO | Week 4 | **Complete** |
| Voice platform: latency and accent testing (real AU network) | CTO | Week 2 | Open |
| LLM: 10 synthetic SOAP evaluation transcripts produced | CTO + Medical Director | Week 3 | Open — requires Medical Director (PRD-001) |
| LLM: hallucination trap test run | CTO | Week 3 | Open |
| LLM: Medical Director blind evaluation of SOAP outputs | Medical Director | Week 4 | Open — requires Medical Director (PRD-001) |
| LLM: final recommendation with Medical Director sign-off | CTO + Medical Director | Week 5 | Open — pending Medical Director |

---

## Dependencies

- PRD-001: Medical Director confirmed (required for blind evaluation and sign-off)
- PRD-001: Regulatory advisor engaged (required for DPA assessment and AU data residency confirmation)

---

## Decision: Voice Platform

**Chosen approach: Gemini 2.5 Flash Live API (direct integration) — contingent on GCP `australia-southeast1` availability confirmation**
**Fallback: Retell.ai**

**Rationale:** The Gemini Live API eliminates the ASR→LLM→TTS latency chain that causes Vapi's real-world lag, delivers native sub-500ms audio, and reduces the voice layer cost from ~$0.92/consult (Retell) to ~$0.024 AUD/consult — a 38× reduction. It also removes third-party voice platform DPA complexity. The question trees are injected as a Gemini system prompt; the session transcript is extracted at call end and handed to Claude Sonnet 4.6 on Bedrock for clinical reasoning. The primary unresolved question is whether Gemini Live API is available within GCP `australia-southeast1` — if it is not, APP 8 is triggered for the voice layer and the fallback to Retell.ai applies.

**Data residency:** GCP `australia-southeast1` must be confirmed for Gemini Live API before Sprint 2 start. GCP DPA covers Vertex AI; confirm Live API is within scope. Fallback: Retell.ai on-premise SIP trunk.

**Key risk:** Gemini Live API integration requires custom WebSocket session management, telephony bridging, and fallback handling — approximately 1–2 sprint weeks of engineering not required with Retell.ai. If Sprint 2 timeline is tight, starting with Retell.ai and migrating to Gemini Live in Sprint 3 is a viable sequencing option.

**Open items before Sprint 2:**
- [ ] Confirm Gemini Live API is available in GCP `australia-southeast1` (contact Google Cloud or check Vertex AI region docs)
- [ ] GCP DPA reviewed; AU data residency terms for Live API confirmed
- [ ] Australian accent accuracy and medical vocabulary validated on AU network
- [ ] If GCP residency unconfirmable: Retell.ai DPA executed as fallback

---

## Decision: Clinical LLM

**Chosen model: Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2**

**Rationale:** Claude Sonnet 4.6 scores 4.70/5 on the weighted criteria, driven by the two highest-weight dimensions: medical reasoning accuracy (92.3% MedQA) and hallucination rate (strongest clinical safety profile of the candidates). It also produces the highest-quality structured long-form outputs — critical for the triple output (SOAP + differential + patient-facing draft). The data sovereignty argument is decisive: Bedrock ap-southeast-2 is already confirmed as the primary inference infrastructure (ROADMAP.md), Sydney ↔ Melbourne geographic routing keeps all inference within AU, and no additional DPA is required beyond the existing AWS agreement.

**Escalation path:** Claude Opus 4.7 should be evaluated for complex cases (multi-system presentations, ambiguous differentials) once the Medical Director has reviewed output quality at scale. Sonnet 4.6 is the default; Opus 4.7 is the escalation.

**Data residency:** AWS Bedrock ap-southeast-2 confirmed. Geographic cross-region inference routes Sydney ↔ Melbourne only. AWS DPA in place. Training opt-out confirmed for Bedrock.

**Key risk:** The 20-question hallucination trap test has not yet been run — no model currently confirmed below the 2% confident hallucination threshold on drug interactions. Until the trap test is complete, the HITL review step is the primary safety control and must not be bypassed.

**Open items before Sprint 4:**
- [ ] 20-question hallucination trap test run against Claude Sonnet 4.6; results scored
- [ ] 10 synthetic AU GP consultation SOAP outputs reviewed blind by Medical Director
- [ ] 20 clinical image samples submitted for photo analysis accuracy evaluation
- [ ] DPA confirmed with Retell.ai (voice platform; separate from Bedrock)
- [ ] Anonymisation approach confirmed as non-personal under Privacy Act with legal counsel
- [ ] AWS Bedrock service quota increase requested for ap-southeast-2 before Sprint 4 load testing
