# PRD-002 — LLM & Voice Platform Evaluation

> **Status:** Not Started
> **Phase:** Pre-Build (Weeks 1–5, concurrent with Sprint 0 build)
> **Type:** Research / Technical Decision
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

## Part 1 — Voice Platform Evaluation (Decision by Sprint 2 start, Week 5)

### Candidates

| Platform | Notes |
|----------|-------|
| **Vapi** | Currently spec'd in NIGHTINGALE.md; websocket-based; custom LLM integration |
| **Retell.ai** | Competing platform; lower-latency claims; check AU data residency |

### Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Real-time latency | 30% | Sub-500ms response essential for natural conversation feel; test on AU network conditions |
| Australian accent accuracy | 25% | Both ASR and TTS must handle Australian English — test with 10+ AU accent samples |
| Healthcare vocabulary | 20% | Accuracy on medical terminology in transcription (medication names, symptoms, anatomical terms) |
| AU data residency / compliance posture | 15% | Does the platform offer AU-region processing? Will the vendor sign a DPA compatible with APP 8? |
| SDK / webhook reliability | 5% | Developer experience; webhook latency; stability of streaming API |
| Pricing model | 5% | Per-minute vs per-consultation; model at 200 consults/month, 7 min average duration |

### Deliverables

- [ ] Both platforms tested on 10 Australian-accented medical consultation samples
- [ ] Latency benchmarked (P50 and P95) from an AU network endpoint
- [ ] Healthcare vocabulary accuracy scored against a 30-term medical word list
- [ ] Data residency options confirmed; DPA compatibility assessed for each
- [ ] Pricing calculated at 200 and 1,000 consultations/month
- [ ] Recommendation written and CTO decision recorded

---

## Part 2 — Clinical LLM Evaluation (Decision by Sprint 4 start, Week 8)

### Candidates

| Model | Provider | Data Residency Option |
|-------|----------|----------------------|
| Claude Sonnet / Opus | Anthropic via AWS Bedrock | ap-southeast-2 (Sydney) — preferred |
| GPT-4o | OpenAI | Azure Australia East — check availability |
| Gemini 1.5 Pro | Google | GCP Sydney — check API access |
| Llama 3 70B | Meta (open source) | Self-hosted on AWS ap-southeast-2 |

### Evaluation Criteria (Weighted Scorecard)

| Criterion | Weight | Evaluation Method |
|-----------|--------|-------------------|
| Medical reasoning accuracy | 30% | Published MedQA (USMLE) and ClinicalBench benchmark scores; 50-question curated test set where scores unavailable |
| Hallucination rate in medical context | 25% | 20-question trap test: plausible-sounding but incorrect drug interactions, dosages, contraindications; score for both rate and confident-vs-hedged halluciations |
| Clinical note quality | 20% | 10 synthetic AU GP consultation transcripts (URTI, UTI, skin rash, musculoskeletal, mental health); blind GP scoring on SOAP structure, accuracy, completeness, patient response readability |
| Multimodal imaging capability | 10% | 20 dermatology/wound images from public test sets; score accuracy, uncertainty expression, poor-quality failure mode |
| Australian data sovereignty & DPA | 10% | Does provider offer AU-region inference? Can data processing be contractually guaranteed to remain in AU? DPA APP 8 compatible? Opt-out of training on submitted data? |
| Cost per consultation | 5% | ~4,800 tokens estimated per consultation (2,000 transcript + 1,500 system prompt + 500 history + 800 output); calculate at current API pricing |
| Latency & reliability | 5% | P50 and P95 for 4,800-token payload; published SLA and historical uptime; streaming support |

**Cost target:** < AUD $2 per consultation for all AI/infra costs combined.
**Latency target:** < 30 seconds from transcript submission to all outputs stored.

### Deliverables

- [ ] Benchmark literature review completed (MedQA, Med-HALT, ClinicalBench published scores)
- [ ] 20-question hallucination trap test run against each candidate; results scored
- [ ] 10 synthetic AU GP consultation transcripts produced and submitted to each candidate
- [ ] Medical Director blind evaluation of SOAP outputs completed (score without knowing which model)
- [ ] 20 clinical image samples submitted to multimodal-capable candidates; results scored
- [ ] Data sovereignty compliance check completed for each provider
- [ ] Cost modelling at 200 and 1,000 consultations/month
- [ ] Latency benchmarks run; streaming support confirmed
- [ ] Completed scoring matrix produced
- [ ] Written recommendation with Medical Director sign-off

---

## Acceptance Criteria

- [ ] Voice platform recommendation documented with scoring rationale; DPA requirements confirmed for chosen provider
- [ ] Clinical LLM recommendation documented with scoring matrix filled in; winning model identified with Medical Director sign-off
- [ ] Hallucination rate for chosen LLM < 2% on trap test (or highest-rated available if none meets threshold — documented accordingly)
- [ ] Data sovereignty DPA requirements identified for both chosen providers; DPA execution tracked in PRD-001
- [ ] Both decisions recorded in ROADMAP.md Key Open Decisions table

---

## Research Timeline

| Task | Owner | Deadline |
|------|-------|----------|
| Voice platform: latency and accent testing | CTO | Week 2 |
| Voice platform: compliance posture and DPA assessment | CTO + Regulatory Advisor | Week 3 |
| Voice platform: recommendation | CTO | Week 4 |
| LLM: benchmark literature review (MedQA, Med-HALT) | CTO | Week 2 |
| LLM: 10 synthetic SOAP evaluation transcripts produced | CTO + Medical Director | Week 3 |
| LLM: hallucination trap test run | CTO | Week 3 |
| LLM: data sovereignty compliance check per provider | Regulatory Advisor + CTO | Week 4 |
| LLM: cost modelling + latency benchmarking | CTO | Week 4 |
| LLM: Medical Director blind evaluation of SOAP outputs | Medical Director | Week 4 |
| LLM: final recommendation with Medical Director sign-off | CTO + Medical Director | Week 5 |

---

## Dependencies

- PRD-001: Medical Director confirmed (required for blind evaluation)
- PRD-001: Regulatory advisor engaged (required for data sovereignty assessment)

---

## Output

Two written decision records appended to this document:

```
## Decision: Voice Platform
Chosen platform: [Vapi / Retell.ai]
Rationale: [2–3 sentences]
Data residency: [confirmed / DPA required]
Key risk: [1 sentence]

## Decision: Clinical LLM
Chosen model: [model name and provider]
Rationale: [2–3 sentences]
Data residency: [AWS Bedrock ap-southeast-2 / other]
Key risk: [1 sentence]
Open items before Sprint 4:
- [ ] DPA confirmed with [provider]
- [ ] Anonymisation approach confirmed as non-personal with legal counsel
```
