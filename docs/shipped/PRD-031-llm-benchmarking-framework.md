# PRD-031 — LLM Model Benchmarking Framework

**Status:** Shipped 2026-04-28  
**Sprint:** 10  
**Priority:** P2 — validates current model selection; identifies cost/quality trade-offs for future roadmap decisions

---

## Problem

The clinical LLM choice (Claude Sonnet 4.6 via Bedrock) was made in Sprint 4 based on benchmark research (RESEARCH-002). That research used publicly available benchmarks (MedQA 92.3%) and a high-level blind GP evaluation on 5 synthetic presentations. Since then:
- Model versions have advanced significantly (Claude 4.x family, GPT-4o, Gemini 2.x)
- Cost structures have changed
- The platform now has a concrete production task format (SOAP + differential + draft response in a specific JSON schema)
- The five core presentations have expanded to 30+

We need an **automated, repeatable benchmarking framework** that tests candidate models against our exact production task — not generic medical benchmarks.

---

## Solution

`api/scripts/benchmark-llm-models.ts` — a standalone TypeScript script that:

1. Runs 10 synthetic Australian GP consultation transcripts (covering all major presentation categories) through each candidate model
2. Scores each response on 5 dimensions
3. Outputs a ranked summary table + JSON results file

---

## Synthetic Scenarios

10 clinically diverse scenarios, each with a 8–11 turn realistic conversation:

| ID | Title | Presentation | Complexity |
|----|-------|-------------|-----------|
| S01 | URTI — Simple Adult | Respiratory / URTI | Low |
| S02 | Uncomplicated UTI | Genitourinary | Low |
| S03 | Uncharacterised Skin Rash | Dermatology | Medium |
| S04 | Anxiety with Low Mood | Mental Health | Medium |
| S05 | Acute Low Back Pain | Musculoskeletal | Medium |
| S06 | Chest Pain — Emergency | Cardiovascular | High (escalation test) |
| S07 | Febrile Child 3yo | Paediatric | Medium |
| S08 | Vaginal Discharge | Women's Health | Low–Medium |
| S09 | Hypertension Management | Cardiovascular | Medium |
| S10 | Elderly Patient — Falls | Geriatric | High (polypharmacy) |

Each scenario includes:
- `expectedKeywords` — keywords that must appear for clinical accuracy scoring
- `forbiddenPhrases` — AHPRA violations that trigger score deductions
- `expectedRedFlags` — safety netting content the plan must address
- `patientContext` — age, sex, medications, allergies (mirrors real consultation context)

---

## Scoring Rubric

| Dimension | Max Points | Method |
|-----------|-----------|--------|
| **SOAP Completeness** | 25 | All four SOAP fields non-trivial (>50 chars); differentials 2–5 items summing to ~100% |
| **AHPRA Compliance** | 25 | Deductions for forbidden certainty phrases; bonuses for correct hedge language |
| **Clinical Accuracy** | 25 | Expected clinical keywords and red flags present in output |
| **Latency** | 15 | 15pts if <10s; 10pts if <20s; 5pts if <40s; 0 if ≥40s |
| **Cost** | 10 | 10pts if <$0.05 AUD/consult; decreasing scale to $0.50 |
| **Total** | **100** | — |

---

## Models Tested

| Model | Provider | API cost (input/output per 1k tokens USD) |
|-------|----------|-------------------------------------------|
| Claude Sonnet 4.6 *(current production)* | Anthropic | $0.003 / $0.015 |
| Claude Haiku 4.5 | Anthropic | $0.0008 / $0.004 |
| Claude Opus 4.7 | Anthropic | $0.015 / $0.075 |
| GPT-4o | OpenAI | $0.0025 / $0.010 |
| GPT-4o-mini | OpenAI | $0.00015 / $0.0006 |

*Google Gemini models can be added by implementing the `provider === "google"` branch in `callGoogle()`.*

---

## Usage

```bash
# Run all scenarios against all Anthropic models (Anthropic key required)
ANTHROPIC_API_KEY=sk-ant-... npx tsx api/scripts/benchmark-llm-models.ts

# Include OpenAI models
ANTHROPIC_API_KEY=sk-ant-... OPENAI_API_KEY=sk-... npx tsx api/scripts/benchmark-llm-models.ts

# Run single scenario against one model
ANTHROPIC_API_KEY=sk-ant-... npx tsx api/scripts/benchmark-llm-models.ts \
  --scenario S04-mental-health-anxiety --model claude-haiku-4-5

# Results are written to: api/scripts/benchmark-results/<timestamp>.json
```

---

## How to Interpret Results

- **SOAP < 18/25**: Model is producing truncated or incomplete clinical notes. Not production-suitable without prompt tuning.
- **AHPRA < 20/25**: Model is using certainty language. Requires prompt reinforcement or model replacement.
- **Clinical < 18/25**: Model is missing critical clinical keywords or red flags — significant patient safety risk.
- **Total < 70**: Do not use for production. Total ≥ 80: production-suitable.

---

## Expected Outcomes (Hypotheses)

Based on prior RESEARCH-002 findings:
- **Claude Sonnet 4.6**: Baseline ~85/100. Best overall balance.
- **Claude Haiku 4.5**: ~70/100. Significant cost saving (~5× cheaper) if clinical accuracy is acceptable.
- **Claude Opus 4.7**: ~88/100. Marginal quality gain vs. Sonnet at 5× cost — likely not worth it.
- **GPT-4o**: ~78/100. Competitive on SOAP but weaker on AHPRA compliance (US-trained, needs prompt tuning for AU regulatory language).
- **GPT-4o-mini**: ~55/100. Cost-competitive with Haiku but likely insufficient clinical accuracy.

*Run the script to get actual results and update this section.*

---

## Acceptance Criteria

- [x] 10 synthetic scenarios covering all major GP presentation categories
- [x] Scenarios are clinically realistic (reviewed against Australian GP consultation patterns)
- [x] Scoring is automated and deterministic for reproducibility
- [x] Results written to JSON for longitudinal comparison across model version updates
- [x] Anthropic and OpenAI providers implemented; Google stub documented
- [x] Script compiles with `npm run typecheck` — no errors
- [x] Emergency scenario (S06 chest pain) included to test escalation handling

---

## Future Extensions

- Add a **GP blind review score** dimension: export SOAP notes to a review form for a human GP to rate clinical appropriateness (replaces/complements the automated keyword check)
- Add **Gemini 1.5 Pro/Flash** provider implementation
- Add **hallucination trap scenarios** — transcripts with deliberately incorrect drug names or impossible clinical combinations; correct models should express uncertainty rather than agreeing
- Integrate into CI as a **nightly benchmark run** with alerting if production model score drops >5 points (model drift detection)
- Add **Australian drug name test** — verify models use PBS brand names and correct AU dosing (not US equivalents)
