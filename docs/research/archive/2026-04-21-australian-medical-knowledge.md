# Research Plan: Grounding the Clinical AI in Australian Medical Practice

> **Status:** Research Required — April 2026
> **Decision needed by:** Before Sprint 2 (voice agent question trees) and Sprint 4 (clinical AI engine)
> **Owner:** Technical Co-founder / CTO + Medical Director

---

## Research Question

How do we ensure the clinical AI engine produces outputs that are:

1. **Clinically aligned** with the Australian standard of care — not US or UK guidelines
2. **Regulatory compliant** with Australian medical advertising, prescribing, and referral rules
3. **Up-to-date** as clinical guidelines evolve over time
4. **Auditable** — the Medical Director can inspect and control all clinical reasoning the AI applies

---

## Why This Is Non-Trivial

General-purpose LLMs (including Claude) are trained predominantly on global — mostly US and UK — medical literature. Without explicit grounding in Australian sources, the clinical AI engine may:

- Recommend medications by US brand names or at dosages inconsistent with Australian PBS-listed formulations
- Reference NICE (UK) or CDC (US) guidelines rather than RACGP (Australia)
- Describe referral pathways inconsistent with Australian specialist access norms (e.g., GP → specialist letter requirements)
- Use regulatory language that violates AHPRA advertising rules — e.g., "diagnose" or "cure" instead of "assess" and "recommend"
- Default to US emergency services (911) rather than Australian (000)
- Reference private health insurance structures or out-of-pocket cost norms that don't match Australian healthcare

---

## Approach: Hybrid RAG + Structured System Prompts (Recommended)

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Fine-tuning** | Train a custom model on Australian medical data | Deep knowledge embedding | Very expensive; data privacy risks; model becomes stale as guidelines update |
| **Prompt engineering only** | Hard-code Australian-specific rules in system prompts | Low cost; immediate control | Shallow coverage; depends on completeness of prompt designer's knowledge |
| **RAG only** | Inject guideline excerpts into each API call | Always up-to-date; auditable | Knowledge base build and maintenance overhead; adds tokens per call |
| **Hybrid: RAG + structured prompts** | System prompts enforce regulatory language; RAG retrieves current guideline content per consultation | Best coverage; auditable; updatable without retraining | Most complex to implement |

**Recommendation: Hybrid RAG + structured system prompts.**

NIGHTINGALE.md already mandates a version-controlled clinical prompt repository under Medical Director authority. The recommendation is to extend this with a RAG knowledge base of Australian clinical guidelines. Fine-tuning is not recommended for Phase 1: it is expensive, creates data privacy complications, and produces a model that goes stale as guidelines are updated.

---

## Australian Clinical Knowledge Sources

### Tier 1 — Authoritative Australian Clinical Guidelines

| Source | Description | Access Model |
|--------|-------------|-------------|
| **eTG Complete (Therapeutic Guidelines)** | Australian standard of care for therapeutic management across all specialties | Licensed institutional subscription; API access available — check terms for AI use |
| **AMH (Australian Medicines Handbook)** | Australian drug monographs, interactions, standard dosing | Licensed institutional subscription; check AI use terms |
| **RACGP (Royal Australian College of GPs)** | Clinical guidelines for GP practice; Red Book (preventive care) | Publicly available; PDF and web downloads; attribution required |
| **MIMS Australia** | Drug database: approved indications, PBS listing status, interactions | Licensed; widely integrated into AU clinical software; check AI use terms |
| **PBS (Pharmaceutical Benefits Scheme)** | Subsidised medication list, prescribing rules, authority requirements | Publicly available via pbs.gov.au; Open Government Licence |
| **MBS (Medicare Benefits Schedule)** | Medicare item numbers and eligibility conditions | Publicly available via mbsonline.gov.au; Open Government Licence |

### Tier 2 — Specialty College Guidelines

| Source | Description |
|--------|-------------|
| RACGP Red Book | Preventive activities in general practice |
| RANZCP clinical practice guidelines | Psychiatry and mental health |
| Australasian College of Dermatologists | Skin condition management |
| Musculoskeletal Australia | MSK condition management and referral pathways |
| Australian Rheumatology Association | Rheumatology guidelines |

### Tier 3 — Regulatory and Compliance Sources

| Source | Description | Why Needed |
|--------|-------------|------------|
| **TGA (Therapeutic Goods Administration)** | Approved drugs and devices; SaMD classification guidance | Ensures AI only references TGA-approved treatments |
| **AHPRA advertising guidelines** | Permissible language for registered health practitioners | Ensures draft responses use compliant language |
| **Privacy Act + Australian Privacy Principles** | Patient data handling obligations | Ensures AI language does not inadvertently breach privacy obligations |
| **Telehealth MBS item numbers** | Medicare telehealth eligibility rules | Relevant for Phase 2 Medicare billing integration |

---

## Implementation: Knowledge Base Design

### Folder Structure

```
clinical-knowledge/
├── therapeutic-guidelines/       # eTG Complete excerpts by condition category
│   ├── respiratory/
│   ├── skin/
│   ├── urological/
│   ├── musculoskeletal/
│   ├── mental-health/
│   ├── gastrointestinal/
│   └── ...
├── medications/                  # PBS-listed medications, standard AU dosing
│   ├── antibiotics.md
│   ├── analgesics.md
│   ├── antihypertensives.md
│   └── ...
├── regulatory/                   # Non-negotiable language and compliance rules
│   ├── ahpra-advertising-rules.md
│   └── tga-approved-treatments.md
├── escalation/                   # AU-specific escalation and referral pathways
│   ├── emergency-000.md
│   ├── specialist-referral.md
│   └── in-person-referral.md
└── question-trees/               # Symptom-specific AI interview logic (version-controlled)
    ├── urti.md
    ├── uti.md
    ├── skin-rash.md
    ├── musculoskeletal-pain.md
    └── mental-health-checkin.md
```

All content in this repository is version-controlled in Git. Every change requires Medical Director review and approval before merge — enforced by branch protection rules.

### RAG Pipeline Design

```
Consultation transcript + patient history
  ↓
Extract presenting complaint(s) and symptom keywords
  ↓
Vector search on clinical knowledge base
  (eTG excerpts + PBS medication list + RACGP guidelines)
  ↓
Retrieve top-K relevant guideline excerpts (tuned by condition category)
  ↓
Compose Claude API system prompt:
  [Hardcoded regulatory constraints]
  + [Retrieved Australian guideline excerpts]
  + [Patient anonymised history + consultation transcript]
  ↓
Claude generates SOAP note + differentials + draft patient response
  grounded in Australian guidelines
  ↓
Output validation (structure check, confidence threshold check)
  ↓
Doctor review queue
```

### Vector Database Options

| Option | Notes |
|--------|-------|
| **pgvector (PostgreSQL extension)** | Runs in existing RDS instance; zero additional infrastructure for MVP; recommended starting point |
| AWS OpenSearch (ap-southeast-2) | Data residency guaranteed; native AWS integration; migrate to this if latency becomes a bottleneck |
| Pinecone | Strong performance; check Australian data residency options before selecting |

**Recommendation for MVP:** pgvector on the existing RDS PostgreSQL instance. It is sufficient for the consultation volumes of Phase 1 (200 consultations/month) and adds no additional infrastructure. Migrate to a dedicated vector store if query latency degrades at scale.

---

## Regulatory Language Constraints (Hardcoded — Not RAG)

The following constraints must be hardcoded into every system prompt. They are not left to RAG retrieval because they are non-negotiable compliance rules that must apply to every output regardless of the presenting condition.

These constraints must be reviewed and signed off by the AHPRA advertising compliance reviewer before Sprint 4.

```
AUSTRALIAN REGULATORY LANGUAGE RULES — REQUIRED IN ALL SYSTEM PROMPTS

ALWAYS USE:
- "assess" (never "diagnose")
- "recommend" (never "prescribe" in patient-facing responses)
- "may indicate" or "is consistent with" (never "you have [condition]")
- "a doctor will review your consultation and advise" (never "the AI has determined")

ALWAYS INCLUDE IN PATIENT-FACING DRAFT RESPONSES:
- "This advice is not a substitute for in-person medical care."
- "If your symptoms worsen or you are concerned, seek immediate medical attention or call 000."

NEVER INCLUDE:
- Medication brand names unless PBS-listed and appropriate for the indication
- Off-label medication uses
- Claims of diagnostic certainty
- Any reference to 911 (Australian emergency number is 000)
- Testimonials or statements that imply guaranteed clinical outcomes
```

---

## Medical Director's Role in Knowledge Governance

NIGHTINGALE.md grants the Medical Director full clinical authority over the prompt and knowledge repository. The governance model is:

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review and approve new question trees | Before deployment | Medical Director |
| Review and approve changes to system prompts | Before deployment | Medical Director |
| Review and approve knowledge base updates | As needed | Medical Director + CTO |
| Audit AI output quality (amendment rate, rejection rate) | Monthly | Medical Director + CTO |
| Update knowledge base when guidelines change | Triggered by eTG/RACGP update notifications | CTO → Medical Director approval |
| Review AI confidence threshold performance | Monthly | CTO |

All changes are made via pull request in the Git repository. Branch protection requires Medical Director approval before any change to `question-trees/`, `regulatory/`, or system prompt templates is merged.

---

## Licensing and Legal Considerations

Before building the RAG knowledge base, the following licensing questions must be resolved:

| Source | Licensing Question | Action Required |
|--------|--------------------|----------------|
| eTG Complete | Institutional licence required; programmatic/AI access may require separate agreement | Contact Therapeutic Guidelines Ltd before build |
| AMH | Institutional licence; AI use terms unclear | Contact AMH before build |
| RACGP guidelines | Freely available; attribution required | Confirm attribution approach |
| PBS data | Open Government Licence — free to use with attribution | No blocker |
| MBS data | Open Government Licence — free to use with attribution | No blocker |
| MIMS Australia | Proprietary; AI integration likely requires a separate commercial agreement | Contact MIMS before build |

**If eTG or AMH licensing prohibits AI use:** The fallback approach is to use RACGP publicly available guidelines + PBS/MBS open data as the primary knowledge base, supplemented by Medical Director-authored summaries of eTG/AMH content.

---

## Research Timeline

| Task | Owner | Deadline |
|------|-------|----------|
| Contact eTG/AMH/MIMS for AI licensing enquiry | CTO | Week 1 |
| AHPRA advertising language constraints — draft for sign-off | Regulatory advisor | Week 2 |
| Initial question trees for 5 common presentations | Medical Director | Week 3 |
| Clinical knowledge base v1 (5 condition categories, PBS meds, escalation) | CTO | Week 4 |
| pgvector setup and indexing of knowledge base v1 | CTO | Week 4 |
| RAG pipeline prototype — tested on 10 synthetic consultations | CTO | Week 5 |
| Medical Director blind comparison: RAG-grounded vs baseline outputs | Medical Director | Week 6 |
| System prompt regulatory language reviewed and signed off by AHPRA reviewer | Regulatory advisor | Week 6 |
| Knowledge governance process (branch protection, PR approval workflow) documented | CTO | Week 7 |

---

## Expected Output

At the end of this research phase:

1. **Licensing confirmed** for eTG, AMH, and MIMS — or fallback knowledge base strategy documented
2. **Clinical knowledge base v1** covering 5–10 common GP presentations, PBS medication references, and Australian escalation pathways
3. **RAG pipeline** integrated into Claude API calls — tested on synthetic consultations, not yet in production
4. **System prompt templates** with hardcoded AHPRA-compliant language — signed off by regulatory advisor
5. **Question trees** for 5 initial symptom presentations — Medical Director approved and version-controlled in Git
6. **Governance workflow** documented: how changes are proposed, reviewed, Medical Director-approved, and deployed
