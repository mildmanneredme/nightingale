# PRD-021 — Clinical Knowledge Base Expansion: Comprehensive GP Presentations

> **Status:** In Progress
> **Phase:** Phase 2 — Sprint 8
> **Type:** Content — Clinical Knowledge Infrastructure
> **Owner:** CTO + Medical Director
> **Predecessor:** [PRD-011 — Clinical Knowledge Base & RAG Pipeline](../shipped/PRD-011-clinical-knowledge-base.md)
> **Companion PRD:** [PRD-019 — Proprietary Knowledge Base Extensions](PRD-019-clinical-knowledge-base-proprietary.md) (eTG, AMH, MIMS — deferred until PRD-021 open-source content stable)

---

## Overview

PRD-011 shipped with 5 GP presentation categories as a deliberate Phase 1 scope decision. The knowledge infrastructure (ingestion pipeline, RAG retrieval, pgvector schema, SNOMED normalisation) is complete and requires no changes. This PRD expands coverage to ~150 conditions spanning the full breadth of common Australian GP practice using exclusively open-source and freely available sources — RACGP guidelines, NHMRC approved guidelines, and recognised Australian specialty college guidelines.

This expansion is a content-only deliverable. No code changes are required to the ingestion pipeline, RAG service, clinical AI engine, or database schema. The existing ingest script (`api/scripts/ingest-knowledge-base.ts`) handles any new folders automatically.

This PRD also completes three PRD-011 content gaps that were specified but never populated: PBS medications index (`F-012`), MBS telehealth items (`F-013`), and RACGP Red Book preventive screening (`F-010`).

---

## Background

The 5 Phase 1 presentations represent fewer than 30% of total GP encounter types in Australian practice. Without expanded coverage, the RAG pipeline returns empty or tangentially relevant guideline excerpts for the majority of real-world consultations, reducing the clinical grounding benefit of the RAG architecture and increasing the risk of AI outputs defaulting to US/UK guidelines.

A comprehensive knowledge base covering ~150 conditions is achievable using freely available Australian sources and provides effective RAG coverage for the vast majority of what a GP manages — common acute presentations, chronic disease monitoring, preventive health, women's health, men's health, paediatrics, geriatrics, and mental health.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Medical Director | Reviews and approves all new knowledge base content via Git PR before merge |
| CTO | Authors all new knowledge base files; proposes PR |
| Clinical AI Engine | Queries knowledge base at runtime; read-only |

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | All new condition folders created under `clinical-knowledge/therapeutic-guidelines/` |
| F-002 | Each folder contains one `racgp-summary.md` following the canonical format (see Format Specification) |
| F-003 | Each file sourced from applicable freely available RACGP, NHMRC, or Australian specialty college guideline |
| F-004 | Each file contains the 8 required section headings (9 for paediatric conditions) |
| F-005 | All content is Australian-specific: AU drug names, PBS listings, 000 not 911, RACGP not NICE/CDC |
| F-006 | All files marked `md_approved_at: PENDING` until Medical Director PR approval |
| F-007 | PRD-011 gap stubs created: `medications/pbs-overview.md`, `mbs-items/telehealth-items.md`, `red-book/preventive-screening.md` |
| F-008 | Medical Director reviews and approves all files before production ingest |

---

## Complete Condition List

**Target: ~150 conditions across all major GP presentation categories**

### Already Shipped (PRD-011 — 5 conditions)
`urti` · `uti` · `skin-rash` · `musculoskeletal` · `mental-health`

---

### Tier 1 — Highest volume (BEACH data top presentations)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `type-2-diabetes` | Type 2 Diabetes — ongoing management | RACGP T2DM Handbook 2020; NHMRC |
| `hypertension` | Hypertension | RACGP; Heart Foundation 2022 |
| `asthma` | Asthma | National Asthma Council Handbook v2.2 |
| `gord` | Gastro-oesophageal Reflux Disease | RACGP; NPS MedicineWise |
| `allergic-rhinitis` | Allergic Rhinitis | ASCIA; RACGP |
| `insomnia` | Insomnia / Sleep Disorders | RACGP; Sleep Health Foundation |
| `iron-deficiency-anaemia` | Iron Deficiency Anaemia | RACGP; Haematology Society of ANZ |
| `headache-migraine` | Headache / Migraine | RACGP; Headache Australia |
| `vitamin-d-deficiency` | Vitamin D Deficiency | RACGP; NHMRC |
| `acute-gastroenteritis` | Acute Gastroenteritis | RACGP; GESA |

---

### Tier 2 — Significant volume

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `copd` | COPD — stable management | Lung Foundation COPDX; RACGP |
| `contraception` | Contraception | RACGP; Family Planning Australia |
| `acne` | Acne | RACGP; Australasian College of Dermatologists |
| `sinusitis` | Sinusitis (Acute) | RACGP; NPS Antibiotic Stewardship |
| `otitis` | Otitis Media / Otitis Externa | RACGP Otitis Media guideline |
| `conjunctivitis` | Conjunctivitis | RACGP; NPS MedicineWise |
| `atrial-fibrillation` | Atrial Fibrillation — stable | NHF AF Guidelines 2018 |
| `heart-failure` | Heart Failure — stable chronic | NHF Heart Failure Guidelines 2018 |
| `irritable-bowel-syndrome` | Irritable Bowel Syndrome | RACGP; GESA |
| `menstrual-disorders` | Menstrual Disorders | RACGP; RANZCOG |
| `menopause` | Menopausal Symptoms | Australasian Menopause Society |
| `thyroid-disorders` | Thyroid Disorders | RACGP; Endocrine Society of Australia |
| `anxiety` | Anxiety Disorders | RACGP; Beyond Blue |
| `cellulitis` | Cellulitis | RACGP; Australasian College of Dermatology |
| `sexually-transmitted-infections` | STIs (chlamydia, gonorrhoea, BV) | ASHM Australian STI Management Guidelines |
| `adhd-adult` | ADHD in Adults | AADPA Guidelines 2022 |
| `obesity` | Obesity / Weight Management | Obesity Australia; RACGP |
| `chronic-pain` | Chronic Pain | ANZCA Faculty of Pain Medicine |
| `alcohol-use` | Alcohol Use / Harmful Drinking | RACGP; NHMRC 2020 |
| `febrile-child` | Febrile Child | PREDICT; RCH Melbourne |
| `constipation` | Constipation | RACGP; GESA |
| `dizziness-vertigo` | Dizziness / Vertigo | RACGP |
| `bph` | Benign Prostatic Hyperplasia | USANZ Guidelines |
| `erectile-dysfunction` | Erectile Dysfunction | Andrology Australia; RACGP |
| `gout` | Gout | Australian Rheumatology Association; RACGP |

---

### Tier 3 — Cardiovascular & Metabolic

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `hyperlipidaemia` | Hyperlipidaemia / Dyslipidaemia | Heart Foundation; RACGP |
| `cardiovascular-risk` | Cardiovascular Risk Assessment | Heart Foundation CVD Risk Calculator; RACGP |
| `chest-pain-assessment` | Chest Pain Assessment (non-acute) | RACGP; NHF |
| `palpitations` | Palpitations Assessment | RACGP |
| `peripheral-arterial-disease` | Peripheral Arterial Disease | Vascular Surgeons of Australia; RACGP |
| `syncope` | Syncope / Presyncope | RACGP |
| `type-1-diabetes` | Type 1 Diabetes — ongoing GP management | RACGP; Australasian Diabetes Society |
| `pcos` | Polycystic Ovary Syndrome | RACGP; Jean Hailes for Women's Health |
| `metabolic-syndrome` | Metabolic Syndrome | RACGP; NHF |
| `gestational-diabetes` | Gestational Diabetes — postnatal follow-up | ADIPS; RACGP |
| `osteoporosis` | Osteoporosis | Osteoporosis Australia; RACGP |
| `hyperuricaemia` | Hyperuricaemia (asymptomatic) | RACGP; Australian Rheumatology Association |

---

### Tier 3 — Respiratory

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `community-acquired-pneumonia` | Community-Acquired Pneumonia | RACGP; Thoracic Society of Australia and NZ |
| `acute-bronchitis` | Acute Bronchitis | RACGP; NPS MedicineWise Antibiotic Stewardship |
| `influenza` | Influenza | RACGP; Australian Immunisation Handbook |
| `covid-19` | COVID-19 Management | RACGP COVID-19 clinical guidance; Australian Government DoH |
| `long-covid` | Long COVID / Post-COVID Syndrome | RACGP Long COVID guidance |
| `whooping-cough` | Pertussis (Whooping Cough) | RACGP; Australian Immunisation Handbook |
| `croup` | Croup | RACGP; RCH Melbourne Clinical Guidelines |
| `bronchiolitis` | Bronchiolitis | RACGP; RCH Melbourne Clinical Guidelines |
| `smoking-cessation` | Smoking Cessation | RACGP Supporting Smoking Cessation guideline |

---

### Tier 3 — Gastrointestinal

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `coeliac-disease` | Coeliac Disease | RACGP; Gastroenterological Society of Australia |
| `inflammatory-bowel-disease` | IBD — Crohn's / Ulcerative Colitis monitoring | RACGP; GESA |
| `nafld` | Non-Alcoholic Fatty Liver Disease | GESA; RACGP |
| `hepatitis-b` | Hepatitis B — chronic management | RACGP; Gastroenterological Society |
| `hepatitis-c` | Hepatitis C | RACGP; Gastroenterological Society; ASHM |
| `helicobacter-pylori` | H. pylori Eradication | RACGP; NPS MedicineWise |
| `haemorrhoids` | Haemorrhoids / Anal Fissure | RACGP |
| `diverticular-disease` | Diverticular Disease | RACGP; GESA |
| `nausea-vomiting` | Nausea and Vomiting | RACGP |
| `rectal-bleeding` | Rectal Bleeding Assessment | RACGP; Cancer Council Australia |

---

### Tier 3 — Musculoskeletal (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `osteoarthritis` | Osteoarthritis (hip/knee) | RACGP; Arthritis Australia |
| `rheumatoid-arthritis` | Rheumatoid Arthritis — GP monitoring | RACGP; Australian Rheumatology Association |
| `fibromyalgia` | Fibromyalgia | RACGP; Australian Rheumatology Association |
| `plantar-fasciitis` | Plantar Fasciitis | RACGP; Podiatry Australia |
| `carpal-tunnel` | Carpal Tunnel Syndrome | RACGP |
| `rotator-cuff` | Rotator Cuff Disorders | RACGP |
| `lateral-epicondylitis` | Lateral Epicondylitis (Tennis Elbow) | RACGP |
| `ankle-sprain` | Ankle Sprain | RACGP; Sports Medicine Australia |
| `low-back-pain-chronic` | Chronic Low Back Pain | RACGP; Pain Australia |

---

### Tier 3 — Neurology

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `epilepsy` | Epilepsy — GP monitoring | RACGP; Epilepsy Australia |
| `parkinsons` | Parkinson's Disease — GP monitoring | RACGP; Parkinson's Australia |
| `multiple-sclerosis` | Multiple Sclerosis — GP monitoring | RACGP; MS Australia |
| `peripheral-neuropathy` | Peripheral Neuropathy | RACGP |
| `restless-legs` | Restless Legs Syndrome | RACGP; Sleep Health Foundation |
| `bells-palsy` | Bell's Palsy | RACGP |
| `tia-followup` | TIA Follow-Up | RACGP; Stroke Foundation Australia |
| `tension-headache` | Tension-Type Headache | RACGP; Headache Australia |
| `dementia-assessment` | Cognitive Decline / Dementia Assessment | RACGP; Dementia Australia |

---

### Tier 3 — Dermatology (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `psoriasis` | Psoriasis | RACGP; Australasian College of Dermatologists |
| `eczema-atopic` | Eczema / Atopic Dermatitis | RACGP; Australasian College of Dermatologists |
| `rosacea` | Rosacea | RACGP; Australasian College of Dermatologists |
| `tinea` | Tinea (Fungal Skin Infections) | RACGP; NPS MedicineWise |
| `herpes-zoster` | Herpes Zoster (Shingles) | RACGP; Australian Immunisation Handbook |
| `skin-cancer-screening` | Skin Cancer Screening & Sun Damage | RACGP; Cancer Council Australia |
| `urticaria` | Urticaria / Angioedema | RACGP; ASCIA |
| `seborrhoeic-dermatitis` | Seborrhoeic Dermatitis | RACGP |
| `warts` | Warts / Molluscum Contagiosum | RACGP |
| `herpes-simplex` | Herpes Simplex (Oral/Genital) | RACGP; ASHM |

---

### Tier 3 — Women's Health (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `postnatal-care` | Postnatal Care | RACGP; RANZCOG |
| `postnatal-depression` | Postnatal Depression | RACGP; beyondblue |
| `cervical-screening` | Cervical Screening | RACGP; Cancer Council Australia |
| `breast-symptoms` | Breast Symptoms / Lumps | RACGP; Cancer Council Australia |
| `endometriosis` | Endometriosis | RACGP; Jean Hailes; RANZCOG |
| `pelvic-inflammatory-disease` | Pelvic Inflammatory Disease | RACGP; ASHM |
| `urinary-incontinence` | Urinary Incontinence | RACGP; Continence Foundation of Australia |
| `vulvodynia` | Vulvodynia / Vulval Conditions | RACGP; Jean Hailes |

---

### Tier 3 — Men's Health (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `prostate-cancer-screening` | Prostate Cancer Screening (PSA discussion) | RACGP; Cancer Council Australia |
| `testicular-pain` | Testicular Pain / Scrotal Symptoms | RACGP |
| `male-hypogonadism` | Male Hypogonadism / Low Testosterone | RACGP; Andrology Australia |

---

### Tier 3 — Mental Health (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `depression` | Depression | RACGP; beyondblue |
| `bipolar-disorder` | Bipolar Disorder — GP monitoring | RACGP; beyondblue; RANZCP |
| `psychosis-monitoring` | Schizophrenia / Psychosis — GP monitoring | RACGP; RANZCP |
| `ptsd` | PTSD | RACGP; Phoenix Australia |
| `ocd` | OCD | RACGP; RANZCP |
| `eating-disorders` | Eating Disorders | RACGP; NEDC |
| `grief-bereavement` | Grief and Bereavement | RACGP |
| `social-anxiety` | Social Anxiety Disorder | RACGP; beyondblue |
| `opioid-dependence` | Opioid Dependence / OAT | RACGP Drugs and Addiction guidelines |

---

### Tier 3 — ENT (extended)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `hearing-loss` | Hearing Loss | RACGP; Audiology Australia |
| `tinnitus` | Tinnitus | RACGP; Audiology Australia |
| `epistaxis` | Epistaxis (Nosebleed) | RACGP |
| `tonsillitis` | Tonsillitis / Pharyngitis | RACGP; NPS MedicineWise |
| `hoarse-voice` | Hoarse Voice / Laryngitis | RACGP |

---

### Tier 3 — Eye Conditions

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `dry-eye` | Dry Eye Syndrome | RACGP; Optometry Australia |
| `subconjunctival-haemorrhage` | Subconjunctival Haemorrhage | RACGP |

---

### Tier 3 — Paediatric

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `childhood-asthma` | Childhood Asthma | National Asthma Council; RACGP |
| `childhood-eczema` | Childhood Eczema | RACGP; Australasian College of Dermatologists |
| `growth-concerns` | Growth Concerns / Failure to Thrive | RACGP; RCH Melbourne |
| `developmental-concerns` | Developmental Concerns / Autism Screening | RACGP; Raising Children Network |
| `immunisation-counselling` | Immunisation Counselling | Australian Immunisation Handbook |
| `school-refusal` | School Refusal / Anxiety in Children | RACGP; beyondblue |
| `childhood-otitis` | Childhood Otitis Media | RACGP Acute Otitis Media guideline |

---

### Tier 3 — Geriatric

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `falls-prevention` | Falls Prevention in Older Adults | RACGP; Falls Prevention Australia |
| `frailty` | Frailty Assessment | RACGP; ACSQHC |
| `polypharmacy-review` | Polypharmacy Review | RACGP; NPS MedicineWise |
| `urinary-incontinence-elderly` | Urinary Incontinence (Older Adults) | RACGP; Continence Foundation |
| `advance-care-planning` | Advance Care Planning | RACGP; Advance Care Planning Australia |

---

### Tier 3 — Infectious Disease

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `wound-infection` | Wound Infection | RACGP |
| `hiv-monitoring` | HIV — stable GP monitoring | ASHM; RACGP |
| `dengue-fever` | Dengue Fever | RACGP; Queensland Health (relevant North AU) |
| `ross-river-fever` | Ross River Fever | RACGP; Queensland Health |
| `infectious-mononucleosis` | Infectious Mononucleosis (Glandular Fever) | RACGP |

---

### Tier 3 — Haematology / Anticoagulation

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `anticoagulation-management` | Anticoagulation Management (warfarin/DOAC) | RACGP; Thrombosis and Haemostasis Society of ANZ |
| `lymphadenopathy` | Lymphadenopathy Assessment | RACGP |
| `thrombosis-dvt` | DVT / Venous Thromboembolism (outpatient management) | RACGP; Thrombosis and Haemostasis Society |

---

### Tier 3 — Oncology (GP role)

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `bowel-cancer-screening` | Bowel Cancer Screening | RACGP; Cancer Council Australia; NBCSP |
| `cancer-survivorship` | Cancer Survivorship — GP monitoring | RACGP; Cancer Council Australia |

---

### Tier 3 — Allergy & Immunology

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `anaphylaxis-management` | Anaphylaxis — Action Plan Review | ASCIA; RACGP |
| `drug-allergy` | Drug Allergy Assessment | ASCIA; RACGP |
| `food-allergy` | Food Allergy Counselling | ASCIA; RACGP |

---

### Tier 3 — Renal

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `chronic-kidney-disease` | Chronic Kidney Disease — monitoring | RACGP; KHA-CARI Guidelines |
| `nephrolithiasis` | Nephrolithiasis (Kidney Stones) | RACGP; Urological Society ANZ |
| `recurrent-uti` | Recurrent UTI | RACGP |

---

### Tier 3 — Travel Medicine & Other

| Slug | Condition | Primary Source |
|------|-----------|---------------|
| `pre-travel-consultation` | Pre-Travel Health Consultation | RACGP; ASID Travel Medicine |
| `malaria-prophylaxis` | Malaria Prophylaxis | RACGP; ASID Travel Medicine |
| `chronic-fatigue` | Chronic Fatigue Syndrome / ME-CFS | RACGP; ME/CFS Australia |
| `unexplained-weight-loss` | Unexplained Weight Loss | RACGP |
| `lymphoedema` | Lymphoedema Management | RACGP; Lymphoedema Australia |
| `domestic-violence` | Domestic and Family Violence — screening | RACGP |
| `opioid-stewardship` | Opioid Stewardship / Chronic Opioid Therapy | RACGP; NPS MedicineWise |
| `fitness-for-work` | Fitness for Work / Occupational Health | RACGP |
| `palliative-care-gp` | Palliative Care in General Practice | RACGP; Palliative Care Australia |

---

**Total new conditions: ~143 (plus 3 PRD-011 gap stubs)**

---

## File Format Specification

All files follow the canonical format from `clinical-knowledge/therapeutic-guidelines/urti/racgp-summary.md`:

```markdown
---
source: [Source name and year]
source_url: [Direct URL]
version: [Year]
category: therapeutic-guidelines
condition: [kebab-case-slug]
md_approved_at: PENDING — awaiting Medical Director review
status: PLACEHOLDER — content accuracy requires Medical Director and RACGP licensing confirmation before production use
---

## [Condition Name] Assessment (RACGP)
## Clinical Presentation
## Assessment Approach
## Key Differentials
## Management Principles
## Prescribing Considerations (AU PBS)
## Escalation Triggers
## Telehealth Suitability

---
*PLACEHOLDER CONTENT — ...*
```

**Rules:**
- Do NOT include an `attribution` field
- All sections must be >50 characters (ingest script minimum)
- Emergency references: `000` not `911`
- Medications: generic names with PBS listing status noted
- Paediatric conditions: add 9th section `## Paediatric Context and Guardian Involvement`

---

## PRD-011 Gap Stubs

| Path | Category |
|------|----------|
| `clinical-knowledge/medications/pbs-overview.md` | `medications` |
| `clinical-knowledge/mbs-items/telehealth-items.md` | `mbs-items` |
| `clinical-knowledge/red-book/preventive-screening.md` | `red-book` |

Omit the `condition` field entirely from stub files (do not write `condition: null`).

---

## Acceptance Criteria

- [ ] ~143 new `racgp-summary.md` files created
- [ ] 3 PRD-011 gap stub files created
- [ ] Ingest script processes all files without errors; reports `therapeutic-guidelines: 1100+` chunks
- [ ] 10 RAG smoke-test queries each return the expected condition in top-5 results
- [ ] Medical Director PR review submitted and approved
- [ ] `ROADMAP.md` updated

---

## Verification — RAG Smoke Tests

| Query | Expected condition |
|-------|-------------------|
| `"high blood pressure on ramipril 6 months"` | `hypertension` |
| `"HbA1c 8.2 on metformin discuss results"` | `type-2-diabetes` |
| `"wheezing short of breath asthma preventer review"` | `asthma` |
| `"burning chest after meals worse at night"` | `gord` |
| `"can't sleep waking 3am tired all day"` | `insomnia` |
| `"migraine visual aura tried sumatriptan"` | `headache-migraine` |
| `"room spinning when rolling over in bed"` | `dizziness-vertigo` |
| `"contraception options thinking about the pill"` | `contraception` |
| `"blackheads whiteheads face teenager"` | `acne` |
| `"child fever 39.5 three years old irritable"` | `febrile-child` |

---

## Dependencies

- PRD-011: Infrastructure complete ✅
- No code changes required to any service

## Out of Scope

- pgvector enablement / embedding generation (tracked separately)
- PBS CSV ingestion automation (stub created; automation is separate deliverable)
- eTG, AMH, MIMS — Phase 2 via PRD-019
