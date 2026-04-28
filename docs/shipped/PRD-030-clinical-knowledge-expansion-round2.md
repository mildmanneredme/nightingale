# PRD-030 — Clinical Knowledge Base: Open-Source Expansion Round 2

**Status:** Shipped 2026-04-28  
**Sprint:** 10  
**Priority:** P1 — raises AI clinical quality ceiling using free, authoritative Australian sources; no commercial licensing required

---

## Background

PRD-011 seeded the knowledge base with five GP presentation categories using the open-source stack (PBS API, MBS, RACGP guidelines, NHMRC, SNOMED CT-AU/AMT). PRD-021 expanded to ~143 condition directories across all major GP presentation categories.

This PRD documents a second round of targeted research into free/open-access Australian clinical sources, delivers ingestion scripts for the highest-value new sources, and adds representative knowledge chunks in the following new categories:
- Australian Prescriber articles (prescribing guidance)
- TGA safety alerts (drug safety signals)
- DermNet NZ (dermatology — CC-BY-NC-ND 3.0)
- ACSQHC Clinical Care Standards
- RACGP Red Book 10th edition new topics

---

## Source Research Summary

### ✅ Tier 1 — Ingest Now (Free, AU-specific, High Clinical Value)

| Source | Type | License | Access Method | Priority |
|--------|------|---------|--------------|----------|
| **Australian Prescriber** (australianprescriber.tg.org.au) | Drug/prescribing guidance journal, government-funded, ~6 issues/year | Open access, non-commercial attribution | HTML/PDF per article; no API | ⭐⭐⭐ |
| **TGA Safety Alerts** (tga.gov.au/resources/datasets) | Drug safety warnings, contraindications, adverse event signals, medicine shortages | Open Government Licence v3.0 | CSV/JSON datasets + searchable DB | ⭐⭐⭐ |
| **DermNet NZ** (dermnetnz.org) | Comprehensive dermatology encyclopaedia; used globally by AU GPs | CC-BY-NC-ND 3.0 (non-commercial) | Web pages + image catalogue; no bulk API | ⭐⭐⭐ |
| **ACSQHC Clinical Care Standards** (safetyandquality.gov.au) | National hospital + community care standards (sepsis, ACS, falls, etc.) | Open access; Crown copyright attribution | PDF + HTML downloads | ⭐⭐ |
| **RACGP Red Book 10th edition — new chapters** | Preventive care guidelines (2024 update — 15 new topics vs. 9th ed.) | RACGP attribution required; freely downloadable | PDF (full document) | ⭐⭐ |
| **National Heart Foundation ACS Guidelines 2025** | Acute coronary syndrome management — published MJA, open access | CC BY-NC-ND 4.0 | PMC article + PDF | ⭐⭐ |
| **Cochrane Plain Language Summaries** (cochranelibrary.com) | Systematic review evidence for key GP interventions; AU national provision = free | CC BY for open-access articles; national provision = free access for AU IPs | Web pages + Cochrane API (beta) | ⭐⭐ |
| **Diabetes Australia Clinical Guidelines** (diabetesaustralia.com.au) | Type 1/2 diabetes management; aligned with NHMRC evidence-based guidelines | Freely available; attribution required | PDF download | ⭐ |

### ⚠️ Tier 2 — Deferred (Licensing Ambiguity or Low ROI)

| Source | Reason Deferred |
|--------|----------------|
| **Better Health Channel (VIC)** | No API or structured open data; web scraping is non-commercial but lacks clear bulk licence; healthdirect partnership better path |
| **Healthdirect content API** | NHSD is a services directory (find a doctor / clinic), not a clinical knowledge API. Partnership with Healthdirect for content requires separate agreement |
| **clinicalguidelines.gov.au** | Portal decommissioned 2021; refer to GIN library or source guidelines directly |
| **eTG Complete** (tg.org.au) | Commercial AI licence required; remains deferred to PRD-019 (Phase 2) |
| **AMH (Australian Medicines Handbook)** | Commercial AI licence required; PRD-019 |
| **MIMS Australia** | Commercial AI integration agreement required; PRD-019 |

---

## What Was Built

### 1. New Knowledge Files

Created `clinical-knowledge/external-sources/` directory with structured knowledge files for:
- `australian-prescriber/` — prescribing guidance for common GP presentations
- `tga-safety/` — drug safety alert summaries and common alert categories
- `dermnet/` — dermatology condition profiles (symptom patterns, differential, management)
- `acsqhc-standards/` — Clinical Care Standard summaries
- `racgp-red-book-10e/` — New chapter topics from the 2024 10th edition

### 2. Ingestion Scripts

- `api/scripts/fetch-tga-alerts.ts` — Downloads current TGA safety alert CSV, parses into knowledge chunks, ingests to RAG
- `api/scripts/fetch-australian-prescriber.ts` — Fetches open-access article index from Australian Prescriber and downloads high-value articles for specific GP presentations

### 3. Ingestion Registry Update

Added `external-sources` to `categoryFromPath()` in the ingestion script to correctly classify the new directory.

---

## Acceptance Criteria

- [x] All 8 Tier 1 sources documented with licensing, access method, and clinical value
- [x] TGA fetch script creates parseable knowledge chunks from open datasets
- [x] Australian Prescriber fetch script targets relevant articles by topic (URTI, UTI, dermatology, mental health, MSK, cardiovascular)
- [x] New knowledge files include proper frontmatter with `source`, `source_url`, `status: PENDING_MD_REVIEW`
- [x] DermNet content used non-commercially with CC-BY-NC-ND attribution in frontmatter
- [x] No content is ingested to production without Medical Director sign-off (md_approved_at field = PENDING)

---

## Regulatory Note

Per CLAUDE.md: **Changes to clinical knowledge require Medical Director approval before production ingest.** All new files carry `status: PENDING_MD_REVIEW` in frontmatter. Run the ingest script in staging only until MD has reviewed and signed off.

---

## Data Volume Estimate

| Source | Est. Chunks | Avg Chunk Size |
|--------|-------------|---------------|
| Australian Prescriber articles (top 40 articles across 6 topics) | ~160 | ~400 tokens |
| TGA safety alerts (last 24 months) | ~80 | ~200 tokens |
| DermNet NZ (top 30 common dermatology conditions) | ~120 | ~600 tokens |
| ACSQHC Clinical Care Standards (sepsis, ACS, falls, deteriorating patient) | ~40 | ~500 tokens |
| RACGP Red Book 10th edition new chapters (15 topics) | ~45 | ~500 tokens |
| NHF ACS Guidelines 2025 | ~20 | ~600 tokens |
| **Total new chunks** | **~465** | — |

This adds approximately 25% more clinical content to the existing knowledge base, with a specific focus on prescribing guidance and dermatology — the two areas with the largest clinical quality gap identified in the PRD-021 expansion.
