# PRD-011 — Clinical Knowledge Base & RAG Pipeline (Phase 1: Open-Source Stack)

> **Status:** Not Started
> **Phase:** Sprint 3 (Week 7–8), with SNOMED licence registration starting Week 1
> **Type:** Technical — Clinical AI Infrastructure
> **Owner:** CTO + Medical Director
> **Companion PRD:** [PRD-019 — Proprietary Knowledge Base Extensions](PRD-019-clinical-knowledge-base-proprietary.md) (eTG, AMH, MIMS — Phase 2)

---

## Overview

The Clinical AI Engine (PRD-012) must produce outputs grounded in Australian clinical guidelines — not US or UK defaults. This PRD builds the knowledge infrastructure that makes that possible using exclusively open-source and freely available Australian data sources: PBS medication data, MBS schedule, RACGP clinical guidelines, NHMRC approved guidelines, and SNOMED CT-AU/AMT clinical terminology.

This approach eliminates all commercial licensing risk from Sprint 3 and unblocks the Sprint 4 Clinical AI Engine build immediately. Proprietary source integration (eTG Complete, AMH, MIMS) is deferred to PRD-019.

This PRD is a hard dependency for PRD-012. The Clinical AI Engine sprint cannot start until the knowledge base, pgvector setup, and system prompt templates are complete and Medical Director-approved.

---

## Background

General-purpose LLMs trained predominantly on global (mostly US/UK) medical literature will, without grounding:

- Recommend medications by US brand names or at dosages inconsistent with Australian PBS-listed formulations
- Reference NICE (UK) or CDC (US) guidelines instead of RACGP
- Describe referral pathways inconsistent with Australian specialist access norms
- Use regulatory language that violates AHPRA advertising rules (e.g., "diagnose" instead of "assess")
- Default to 911 rather than 000 for emergency services

The hybrid RAG + structured system prompt approach (recommended over fine-tuning) keeps the knowledge base auditable, updateable without model retraining, and under Medical Director authority.

Fine-tuning is explicitly ruled out for Phase 1: it is expensive, creates data privacy complications, and produces a model that goes stale as guidelines update.

**Why open-source first:** The research phase (see [2026-04-23-open-source-knowledge-bases.md](../research/archive/2026-04-23-open-source-knowledge-bases.md)) confirmed that PBS, MBS, RACGP, NHMRC, and SNOMED CT-AU/AMT together provide sufficient coverage for all 5 Phase 1 GP presentation categories. This stack can be built without vendor negotiation, is updated on regular government release cycles, and covers medications, clinical guidelines, escalation pathways, and terminology normalisation.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Medical Director | Reviews and approves all knowledge base content and system prompt templates via Git PR; sole approver on the clinical prompt repository branch |
| CTO | Authors and maintains knowledge base content; proposes changes via PR |
| Regulatory Advisor | Reviews and signs off AHPRA advertising language constraints |
| Clinical AI Engine | Queries pgvector at runtime; read-only access to indexed knowledge base |

---

## Functional Requirements

### Knowledge Source Registration & Licences

| # | Requirement |
|---|-------------|
| F-001 | Register for PBS Developer Portal API key (free; [data.pbs.gov.au](https://data.pbs.gov.au)) before Sprint 3 |
| F-002 | Register on NCTS ([healthterminologies.gov.au](https://www.healthterminologies.gov.au)) and accept SNOMED CT Affiliate Licence Agreement and Australian National Terminology Licence Agreement (both free) before Sprint 3 |
| F-003 | Confirm with ADHA in writing that SNOMED CT-AU/AMT may be embedded in a commercial AI product's vector store under the Affiliate Licence — required before indexing AMT content |
| F-004 | Confirm RACGP guideline attribution requirements — provide attribution in knowledge base file metadata; no other licensing blocker expected |
| F-005 | PBS and MBS data used under Open Government Licence; attribution included in metadata; no licensing blocker |

### Knowledge Base Content — Phase 1 Sources

| # | Requirement |
|---|-------------|
| F-006 | Knowledge base stored in `clinical-knowledge/` within the clinical prompt Git repository |
| F-007 | Folder structure: `therapeutic-guidelines/{condition-category}/`, `medications/`, `regulatory/`, `escalation/`, `question-trees/`, `terminology/` |
| F-008 | Version 1 covers 5 GP presentation categories: URTI, UTI, skin rash, musculoskeletal pain, mental health check-in |
| F-009 | Each condition category folder sourced from the applicable RACGP clinical guideline (freely available PDF; extracted and chunked by section) |
| F-010 | RACGP Red Book (10th edition, 2024) ingested and chunked by topic — covers preventive screening, lifestyle counselling, and chronic disease across all 5 presentation categories |
| F-011 | NHMRC approved guidelines ingested for applicable Phase 1 presentations (diabetes, mental health) |
| F-012 | PBS medication data indexed from monthly CSV download: generic name, PBS listing status, approved indications, prescribing restrictions, authority requirements, standard AU dosing |
| F-013 | MBS telehealth item numbers ingested as a structured lookup table: item number, service description, eligibility conditions — used for escalation and referral pathway logic |
| F-014 | SNOMED CT-AU snapshot loaded into a relational reference table (not vector store) for terminology normalisation during RAG retrieval |
| F-015 | Escalation content authored by Medical Director, covering: emergency (000), in-person GP referral triggers, specialist referral triggers |
| F-016 | All knowledge base content reviewed and approved by Medical Director before indexing |
| F-017 | Each knowledge base file includes: source name, source URL, version/date of source, Medical Director sign-off date |

### AHPRA Regulatory Language Constraints

| # | Requirement |
|---|-------------|
| F-018 | Draft regulatory language constraints for system prompts, based on AHPRA advertising guidelines |
| F-019 | Regulatory constraints reviewed and signed off by AHPRA advertising compliance reviewer before Sprint 4 |
| F-020 | Approved constraints stored in `clinical-knowledge/regulatory/ahpra-advertising-rules.md` (version-controlled) |
| F-021 | Constraints are hardcoded into every system prompt template — not retrieved via RAG — because they are non-negotiable for every output regardless of presenting condition |

**Required constraints (must be in every system prompt):**
- Use "assess" (never "diagnose"); "recommend" (never "prescribe" in patient-facing responses); "may indicate" or "is consistent with" (never "you have [condition]")
- Always include in patient-facing drafts: "This advice is not a substitute for in-person medical care" and reference to 000 for emergencies
- Never include: medication brand names unless PBS-listed, off-label uses, claims of diagnostic certainty, references to 911

### RAG Infrastructure

| # | Requirement |
|---|-------------|
| F-022 | pgvector extension enabled on existing RDS PostgreSQL instance (no new infrastructure required for Phase 1) |
| F-023 | Embedding model selected and confirmed compatible with Claude Sonnet 4.6 via Bedrock (from PRD-002) |
| F-024 | RACGP and NHMRC guideline chunks, PBS medication records, and escalation content embedded and indexed in pgvector |
| F-025 | SNOMED CT-AU maintained as a separate relational table for term normalisation lookups — not vector-embedded |
| F-026 | RAG retrieval function: given a presenting complaint and symptom keywords, returns top-K relevant guideline excerpts |
| F-027 | Retrieval tested on 10 synthetic consultation scenarios; retrieved excerpts are relevant to presenting complaint in all 10 cases |
| F-028 | Retrieval latency < 500ms for a typical query |

### Knowledge Base Refresh Process

| # | Requirement |
|---|-------------|
| F-029 | PBS medication data refreshed monthly (PBS schedule is updated on the first of every month) — automated download and re-index as part of monthly maintenance |
| F-030 | SNOMED CT-AU/AMT refreshed when NCTS releases a new snapshot (typically quarterly) |
| F-031 | RACGP and NHMRC guideline content reviewed manually when a guideline affecting Phase 1 categories is updated — CTO proposes update PR; Medical Director approves before re-index |

### System Prompt Templates

| # | Requirement |
|---|-------------|
| F-032 | Base system prompt template created: structure is [hardcoded regulatory constraints] + [retrieved guideline excerpts placeholder] + [patient context placeholder] |
| F-033 | System prompt templates stored in version-controlled Git repository; changes require Medical Director PR approval |
| F-034 | Medical Director has reviewed and approved all system prompt templates before Sprint 4 |
| F-035 | System prompt for SOAP note generation, differential diagnosis, and patient draft response each have their own template |

### RAG Pipeline Prototype

| # | Requirement |
|---|-------------|
| F-036 | End-to-end RAG pipeline prototype built: transcript in → keyword extraction → SNOMED normalisation → vector retrieval → system prompt assembly → LLM call → structured output |
| F-037 | Prototype tested on 10 synthetic consultations |
| F-038 | Medical Director conducts blind comparison: RAG-grounded outputs vs baseline (no RAG) outputs on same consultations |
| F-039 | RAG-grounded outputs score higher than baseline on Australian medication accuracy and guideline alignment |

### Governance Workflow

| # | Requirement |
|---|-------------|
| F-040 | Branch protection rules configured: `question-trees/`, `regulatory/`, and system prompt templates require Medical Director PR approval before merge |
| F-041 | Knowledge base update process documented: CTO proposes PR triggered by guideline change; Medical Director reviews and approves before re-index |
| F-042 | Monthly PBS re-index is automated and does not require Medical Director PR approval (data content, not clinical reasoning) — CTO reviews and documents the update |
| F-043 | Medical Director audit schedule documented: monthly review of AI output quality (amendment rate, rejection rate) |

---

## Non-Functional Requirements

- **Auditability:** Every RAG retrieval logged with: query keywords, top-K sources retrieved, consultation ID — so any output can be traced back to the guideline excerpts that informed it
- **Freshness:** PBS re-indexed monthly (automated); RACGP/NHMRC reviewed within 30 days of a material guideline update
- **Sovereignty:** pgvector runs on the existing RDS instance in ap-southeast-2; no knowledge base content leaves Australia during indexing or retrieval

---

## Compliance Notes

**Content licensing:** All Phase 1 sources are free to use. PBS and MBS are under Open Government Licence. RACGP and NHMRC guidelines are freely available with attribution. SNOMED CT-AU/AMT requires free registration and written confirmation from ADHA that commercial vector store embedding is permitted under the Affiliate Licence (F-003).

**Medical Director authority:** All knowledge base content and system prompt templates require Medical Director PR approval before merge. This is a TGA SaMD compliance requirement — the Medical Director is the designated clinical authority over all AI clinical content.

**AHPRA constraints are hardcoded, not retrieved:** Regulatory language constraints are injected into every system prompt as a static block, not as a RAG result. This prevents them from being omitted or diluted by retrieval ranking.

**Data sovereignty:** pgvector runs on the existing RDS instance in ap-southeast-2.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `rag.retrieval_performed` | RAG query executed; includes query_keywords, top_k_sources, consultation_id |
| `knowledge_base.updated` | New content merged and re-indexed; includes PR reference and Medical Director approval date |
| `knowledge_base.pbs_refreshed` | Monthly PBS re-index completed; includes schedule date and record count |

---

## Acceptance Criteria

- [ ] PBS Developer Portal API key registered; monthly CSV download pipeline automated
- [ ] NCTS registration complete; SNOMED CT Affiliate Licence and Australian National Terminology Licence accepted
- [ ] ADHA written confirmation that commercial vector store embedding of SNOMED CT-AU/AMT is permitted
- [ ] RACGP attribution approach confirmed and applied to all knowledge base file metadata
- [ ] Knowledge base v1 covers 5 GP presentation categories; all content Medical Director-approved
- [ ] PBS medication data indexed in pgvector; SNOMED CT-AU loaded in relational reference table
- [ ] AHPRA regulatory language constraints signed off by advertising compliance reviewer
- [ ] pgvector enabled on RDS; RACGP/NHMRC guideline chunks embedded and indexed
- [ ] RAG retrieval tested on 10 synthetic scenarios; relevant excerpts returned in all 10 cases
- [ ] System prompt templates completed and Medical Director-approved
- [ ] End-to-end RAG pipeline prototype tested; Medical Director blind comparison shows improvement over baseline
- [ ] Branch protection rules active on clinical knowledge repo
- [ ] Knowledge base update and governance process documented
- [ ] Monthly PBS re-index process automated and documented

---

## Build Timeline

| Task | Owner | Deadline |
|------|-------|----------|
| PBS Developer Portal registration; NCTS registration | CTO | Week 1 |
| Confirm ADHA licence terms for commercial vector store use (email/call) | CTO | Week 1 |
| AHPRA advertising language constraints — draft | Regulatory Advisor | Week 2 |
| Initial question trees for 5 presentations | Medical Director | Week 3 |
| RACGP Red Book + condition-specific guideline PDFs — extracted and chunked | CTO | Week 4 |
| PBS monthly CSV downloaded and parsed into structured records | CTO | Week 4 |
| MBS telehealth item number lookup table built | CTO | Week 4 |
| SNOMED CT-AU snapshot downloaded and loaded into reference table | CTO | Week 4 |
| Medical Director review and sign-off: all knowledge base content v1 | Medical Director | Week 5 |
| AHPRA constraints signed off by compliance reviewer | Regulatory Advisor | Week 6 |
| pgvector enabled on RDS; knowledge base v1 embedded and indexed | CTO | Sprint 3 (Week 7) |
| Monthly PBS re-index process automated | CTO | Sprint 3 (Week 7) |
| RAG pipeline prototype tested on 10 synthetic consultations | CTO | Sprint 3 (Week 8) |
| Medical Director blind comparison: RAG vs baseline | Medical Director | Sprint 3 (Week 8) |
| Governance workflow documented; branch protection active | CTO | Sprint 3 (Week 8) |

---

## Dependencies

- PRD-003: RDS PostgreSQL instance provisioned (pgvector runs on existing instance)
- PRD-008 (AI Voice Consultation): question trees are placeholder system prompts pending Medical Director content from this PRD

---

## Out of Scope (Phase 1)

- eTG Complete (Therapeutic Guidelines) — Phase 2 via PRD-019
- AMH (Australian Medicines Handbook) — Phase 2 via PRD-019
- MIMS Australia drug database — Phase 2 via PRD-019
- All GP presentation categories beyond the initial 5 (Phase 2 backlog)
- Specialty college guidelines (RANZCP, ACD, etc.) — Phase 2
- Automated guideline update detection — Phase 2 (Phase 1 is manual update trigger)
- My Health Record integration — requires ADHA conformance testing; post-Phase 1
- Migration from pgvector to dedicated vector store — Phase 2 if query latency degrades at scale
