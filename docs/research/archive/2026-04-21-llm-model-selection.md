# Research Plan: LLM Model Selection for Clinical AI Engine

> **Status:** Research Required — April 2026
> **Decision needed by:** Before Sprint 4 (Clinical AI Engine build)
> **Owner:** Technical Co-founder / CTO

---

## Research Question

Which large language model (LLM) is best suited for the three core clinical tasks in Project Nightingale, evaluated using an evidence-based methodology?

**Three core clinical tasks:**
1. **SOAP note generation** from a consultation transcript
2. **Differential diagnosis** with ranked differentials and confidence levels
3. **Draft patient-facing response** in plain English

A fourth task applies to a subset of consultations:
4. **Medical photo analysis** (skin, throat, wounds) — requires multimodal capability

---

## Candidate Models

| Model | Provider | Notes |
|-------|----------|-------|
| Claude 3.7 Sonnet / Claude 4 Opus | Anthropic | Currently spec'd in NIGHTINGALE.md; strong long-context reasoning |
| GPT-4o | OpenAI | Strong medical reasoning benchmarks; multimodal |
| Gemini 1.5 Pro / 2.0 Flash | Google | Multimodal; large context window; Google Cloud AU region available |
| Med-PaLM 2 | Google | Medical-specific fine-tune; limited general API availability |
| Llama 3 70B + medical fine-tunes | Meta (open source) | Self-hosted option; strong data sovereignty advantage |
| Mistral Large | Mistral | European-hosted; emerging medical use; check AU data residency |

---

## Evaluation Criteria

### 1. Medical Reasoning Accuracy (Weight: 30%)

**Benchmarks to assess:**

| Benchmark | Description | Why It Matters |
|-----------|-------------|----------------|
| MedQA (USMLE) | US medical licensing exam questions | Gold standard for general clinical reasoning |
| MedMCQA | Indian medical entrance exam | Broad clinical knowledge coverage |
| PubMedQA | Research literature Q&A | Evidence synthesis capability |
| MMLU (Medical subset) | Multi-domain academic knowledge | Breadth of medical knowledge |
| ClinicalBench | Clinical note generation tasks | Directly relevant to SOAP note generation |

**Research actions:**
- Pull current published leaderboard scores for each candidate model on these benchmarks
- Note benchmark publication dates — ensure scores reflect current model versions
- Where leaderboard scores are unavailable, run a curated 50-question test set against each model API
- Prioritise MedQA and ClinicalBench as most directly relevant to Nightingale's task profile

---

### 2. Hallucination Rate in Medical Context (Weight: 25%)

Hallucinated drug names, dosages, or contraindications are the highest-risk failure mode. The HITL architecture mitigates but does not eliminate this risk — a busy GP may miss a confidently-stated error.

**Research actions:**
- Review published hallucination rate studies specific to medical tasks (Med-HALT benchmark, TruthfulQA medical subset)
- Design a 20-question "trap" test set: questions with plausible-sounding but incorrect drug interactions, dosages, and contraindications
- Run each candidate model against this test set and score for hallucination rate
- Separately score for _confident_ hallucinations (stated without hedging) — these carry higher clinical risk than hedged uncertain responses

---

### 3. Clinical Note Quality (Weight: 20%)

Specific to the SOAP note and draft patient response tasks.

**Research actions:**
- Construct 10 synthetic consultation transcripts covering common Australian GP presentations (URTI, UTI, skin rash, musculoskeletal, mental health check-in)
- Submit identical transcripts to each candidate model with a standardised system prompt
- Evaluate outputs blindly against a rubric covering:
  - SOAP structure adherence
  - Clinical accuracy of assessment
  - Completeness of plan
  - Readability of patient-facing response
  - Appropriate confidence calibration
- Have Medical Director (GP partner) score outputs without knowing which model produced them

---

### 4. Multimodal Medical Imaging Capability (Weight: 10%)

Required for photo analysis (skin, throat, wounds) — a subset of Nightingale consultations.

**Research actions:**
- Identify publicly available dermatology and clinical image test sets (DermaMNIST, ISIC archive samples)
- Submit 20 representative images to each multimodal-capable candidate (Claude, GPT-4o, Gemini)
- Evaluate: accuracy of image interpretation, appropriate expression of uncertainty, failure mode when image quality is poor
- Any model without multimodal capability is disqualified from photo analysis; assess whether a separate specialist model (e.g., a dermatology fine-tune) is warranted for this task

---

### 5. Australian Data Sovereignty & Compliance (Weight: 10%)

All patient data must remain in Australia. Even with anonymisation (which NIGHTINGALE.md mandates), the choice of provider affects contractual data residency guarantees.

**Research actions for each candidate:**

| Question | Why It Matters |
|----------|---------------|
| Does the provider offer an AWS Sydney (ap-southeast-2), Azure Australia East, or GCP Sydney region endpoint? | Data residency requirement |
| Can data processing be contractually guaranteed to remain in Australia? | Privacy Act / APP 11 |
| Does the provider offer a DPA compatible with Australian Privacy Act obligations? | Contractual requirement |
| Does the provider have ISO 27001 / SOC 2 Type II certification? | Security baseline |
| Does the provider permit opting out of model training on submitted data? | NIGHTINGALE.md data moat strategy |
| Is the provider HIPAA-compliant? | US equivalent; indicator of healthcare compliance maturity |

**Anonymisation note:** NIGHTINGALE.md mandates patient data is anonymised before being sent to external LLM APIs. Verify with legal counsel that the anonymisation approach is sufficient to qualify as non-personal data under the Australian Privacy Act — this affects what residency guarantees are legally required.

---

### 6. Cost Per Consultation (Weight: 5%)

NIGHTINGALE.md financial model targets ~$2 AUD per consultation for all AI/infra costs combined.

**Research actions:**
- Obtain current API pricing (per 1M input/output tokens) for each candidate
- Estimate token consumption for a typical Nightingale consultation:
  - Average transcript: ~2,000 tokens
  - System prompt + question trees: ~1,500 tokens
  - Patient history context: ~500 tokens
  - Output (SOAP + differentials + draft response): ~800 tokens
  - **Estimated total per consultation: ~4,800 tokens**
- Calculate cost per consultation at current pricing
- Model as a range, not a point estimate — API pricing changes frequently

---

### 7. Latency & API Reliability (Weight: 5%)

The clinical AI engine runs after the voice consultation completes, so real-time latency is less critical than for the voice agent itself. SOAP + draft response generation should complete within 30 seconds to keep the doctor review queue responsive.

**Research actions:**
- Benchmark P50 and P95 response latency for a typical Nightingale payload (4,800 tokens in, 800 tokens out) for each candidate
- Review each provider's published SLA and historical uptime record
- Assess streaming support (enables progressive rendering in doctor dashboard)

---

## Decision Framework

Score each candidate 1–5 on each criterion, then apply weights to produce a weighted total.

Candidates updated to April 2026 available models: Claude Sonnet 4.6 (Bedrock), GPT-4o (Azure AU East), Gemini 2.5 Flash (GCP Vertex AI), Llama 3 70B (self-hosted). Med-PaLM 2 excluded — no general API access. Mistral excluded — no confirmed AU data residency.

| Criterion | Weight | Claude Sonnet 4.6 | GPT-4o | Gemini 2.5 Flash | Llama 3 70B |
|-----------|--------|:-----------------:|:------:|:----------------:|:-----------:|
| Medical reasoning accuracy | 30% | 4.5 (92.3% MedQA) | 4.0 (~90.9% MedQA w/CoT) | 3.5 (~88% est.) | 3.0 (~75–80%) |
| Hallucination rate | 25% | 4.5 | 3.5 (23.6 errors/SOAP case) | 4.0 (high Med-HALT resistance) | 3.0 |
| Clinical note quality | 20% | 4.5 | 3.5 | 3.5 | 2.5 |
| Multimodal imaging | 10% | 4.0 | 4.0 (67.8–88.3% dermatology) | 3.5 | 2.0 |
| AU data sovereignty | 10% | 5.0 (Bedrock confirmed) | 4.0 | 4.0 | 5.0 (self-hosted) |
| Cost per consultation | 5% | 4.5 (~AUD $0.043) | 4.5 (~AUD $0.029) | 5.0 (~AUD $0.005) | 1.5 (~AUD $18 at 200/mo) |
| Latency & reliability | 5% | 4.0 | 4.0 | 4.5 | 3.0 |
| **Weighted total** | | **4.70 / 5** | **4.00 / 5** | **3.98 / 5** | **3.08 / 5** |

**Decision: Claude Sonnet 4.6 via AWS Bedrock ap-southeast-2.** Full rationale in PRD-002.

---

## Voice AI Platform: Separate but Related Decision

NIGHTINGALE.md §12 notes that Vapi vs Retell.ai requires a formal provider analysis. This is a distinct decision from the clinical AI engine — the voice platform handles real-time conversation; the clinical AI engine processes the completed transcript.

**Evaluate for voice AI platform:**

| Criterion | Description |
|-----------|-------------|
| Real-time latency | Must feel natural in conversation — critical; sub-500ms response is the target |
| Australian accent accuracy | Both platforms must be tested on Australian English specifically |
| Healthcare vocabulary | Ability to handle medical terminology accurately in transcription |
| LLM integration | How well it integrates with the chosen clinical AI model as the underlying engine |
| Healthcare compliance posture | HIPAA equivalent; data residency options |
| Pricing model | Per-minute vs per-consultation — model at 200 consults/month, 7 min average |
| Fallback handling | Behaviour on poor audio connections |
| SDK/API maturity | Developer experience; webhook reliability |

---

## Expected Output

A completed version of this document with the scoring matrix filled in, plus a written recommendation section appended:

```
## Recommendation

**Primary clinical AI model:** [model name]
**Rationale:** [2–3 sentence summary of why this model won on weighted criteria]
**Key risk:** [1 sentence on the main downside or assumption to monitor]
**Voice platform:** [Vapi or Retell.ai] — [1 sentence rationale]

**Open items before Sprint 4 build:**
- [ ] Confirm data sovereignty DPA signed with [provider]
- [ ] Confirm anonymisation approach satisfies Privacy Act with legal counsel
- [ ] Voice platform contract and compliance docs received
```

---

## Research Timeline

| Task | Owner | Deadline |
|------|-------|----------|
| Benchmark literature review (MedQA, Med-HALT published scores) | CTO | Week 2 |
| SOAP note quality blind evaluation (10 synthetic transcripts) | CTO + Medical Director | Week 3 |
| Hallucination trap test set (20 questions) run | CTO | Week 3 |
| Data sovereignty compliance check per provider | Regulatory advisor + CTO | Week 4 |
| Cost modelling at 200 and 1,000 consults/month | CTO | Week 4 |
| Latency benchmarking | CTO | Week 4 |
| Voice platform evaluation (Vapi vs Retell.ai) | CTO | Week 4 |
| Final recommendation written + Medical Director sign-off | CTO + Medical Director | Week 5 |
