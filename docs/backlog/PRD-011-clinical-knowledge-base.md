# PRD-011 — Clinical Knowledge Base & RAG Pipeline

> **Status:** Not Started
> **Phase:** Sprint 3 (Week 7–8), with licensing actions starting Week 1
> **Type:** Technical — Clinical AI Infrastructure
> **Owner:** CTO + Medical Director

---

## Overview

The Clinical AI Engine (PRD-012) must produce outputs grounded in Australian clinical guidelines — not US or UK defaults. This PRD builds the knowledge infrastructure that makes that possible: a licensed, version-controlled Australian clinical knowledge base, a RAG retrieval pipeline, and the AHPRA-compliant system prompt templates that are hardcoded into every AI call.

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

Fine-tuning is explicitly ruled out for Phase 1: it is expensive, creates data privacy complications when training on patient-adjacent data, and produces a model that goes stale as guidelines update.

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

### Knowledge Source Licensing

| # | Requirement |
|---|-------------|
| F-001 | Contact Therapeutic Guidelines Ltd (eTG Complete) for AI/programmatic use licensing before Sprint 3 |
| F-002 | Contact Australian Medicines Handbook (AMH) for AI/programmatic use licensing before Sprint 3 |
| F-003 | Contact MIMS Australia for commercial AI integration agreement before Sprint 3 |
| F-004 | Confirm RACGP guideline attribution requirements; no licensing blocker expected |
| F-005 | Confirm PBS and MBS data use under Open Government Licence; no licensing blocker expected |
| F-006 | If eTG or AMH licensing prohibits AI use: document fallback strategy (RACGP + PBS/MBS open data + Medical Director-authored summaries of eTG/AMH content) |

### Knowledge Base Structure

| # | Requirement |
|---|-------------|
| F-007 | Knowledge base stored in `clinical-knowledge/` within the clinical prompt Git repository (established in PRD-001) |
| F-008 | Folder structure: `therapeutic-guidelines/{condition-category}/`, `medications/`, `regulatory/`, `escalation/`, `question-trees/` |
| F-009 | Version 1 covers at minimum 5 GP presentation categories: URTI, UTI, skin rash, musculoskeletal pain, mental health check-in |
| F-010 | Medications content covers PBS-listed drugs for covered presentations: generic names, PBS listing status, standard AU dosing, common interactions |
| F-011 | Escalation content covers: emergency (000), when to refer to specialist, when to recommend in-person GP visit |
| F-012 | All knowledge base content reviewed and approved by Medical Director before indexing |
| F-013 | Each knowledge base file includes: source reference, version date, Medical Director sign-off date |

### AHPRA Regulatory Language Constraints

| # | Requirement |
|---|-------------|
| F-014 | Draft regulatory language constraints for system prompts, based on AHPRA advertising guidelines |
| F-015 | Regulatory constraints reviewed and signed off by AHPRA advertising compliance reviewer before Sprint 4 |
| F-016 | Approved constraints stored in `clinical-knowledge/regulatory/ahpra-advertising-rules.md` (version-controlled) |
| F-017 | Constraints are hardcoded into every system prompt template — not retrieved via RAG — because they are non-negotiable for every output regardless of presenting condition |

**Required constraints (must be in every system prompt):**
- Use "assess" (never "diagnose"); "recommend" (never "prescribe" in patient-facing responses); "may indicate" or "is consistent with" (never "you have [condition]")
- Always include in patient-facing drafts: "This advice is not a substitute for in-person medical care" and reference to 000 for emergencies
- Never include: medication brand names unless PBS-listed, off-label uses, claims of diagnostic certainty, references to 911

### RAG Infrastructure

| # | Requirement |
|---|-------------|
| F-018 | pgvector extension enabled on existing RDS PostgreSQL instance (no new infrastructure required for Phase 1) |
| F-019 | Embedding model selected and confirmed compatible with chosen clinical LLM (from PRD-002) |
| F-020 | Knowledge base v1 chunked, embedded, and indexed in pgvector |
| F-021 | RAG retrieval function: given a presenting complaint + symptom keywords, returns top-K relevant guideline excerpts |
| F-022 | Retrieval tested on 10 synthetic consultation scenarios; retrieved excerpts are relevant to presenting complaint in all 10 cases |
| F-023 | Retrieval latency < 500ms for a typical query (does not meaningfully add to total engine latency) |

### System Prompt Templates

| # | Requirement |
|---|-------------|
| F-024 | Base system prompt template created: structure is [hardcoded regulatory constraints] + [retrieved guideline excerpts placeholder] + [patient context placeholder] |
| F-025 | System prompt templates stored in version-controlled Git repository; changes require Medical Director PR approval |
| F-026 | Medical Director has reviewed and approved all system prompt templates before Sprint 4 |
| F-027 | System prompt for SOAP note generation, differential diagnosis, and patient draft response each have their own template |

### RAG Pipeline Prototype

| # | Requirement |
|---|-------------|
| F-028 | End-to-end RAG pipeline prototype built: transcript in → keyword extraction → vector retrieval → system prompt assembly → LLM call → structured output |
| F-029 | Prototype tested on 10 synthetic consultations (same set used in PRD-002 LLM evaluation) |
| F-030 | Medical Director conducts blind comparison: RAG-grounded outputs vs baseline (no RAG) outputs on same consultations |
| F-031 | RAG-grounded outputs score higher than baseline on Australian medication accuracy and guideline alignment |

### Governance Workflow

| # | Requirement |
|---|-------------|
| F-032 | Branch protection rules configured on clinical knowledge repo: `question-trees/`, `regulatory/`, and system prompt templates require Medical Director PR approval before merge |
| F-033 | Knowledge base update process documented: triggered by eTG/RACGP guideline update notifications; CTO proposes PR; Medical Director reviews and approves |
| F-034 | Medical Director audit schedule documented: monthly review of AI output quality (amendment rate, rejection rate) |

---

## Non-Functional Requirements

- **Auditability:** Every RAG retrieval is logged with: query keywords, top-K sources retrieved, consultation ID — so any output can be traced back to the guideline excerpts that informed it
- **Freshness:** Knowledge base update process ensures content is reviewed within 30 days of a material eTG or RACGP guideline change
- **Sovereignty:** pgvector runs on the existing RDS instance in ap-southeast-2; no knowledge base content leaves Australia

---

## Compliance Notes

**Content licensing:** eTG, AMH, and MIMS content requires a commercial AI use agreement before indexing. RACGP and PBS/MBS data is freely available with attribution. If licensing is refused, the Medical Director-authored fallback strategy (RACGP + PBS/MBS + MD summaries) must be documented and approved before Sprint 4 start.

**Medical Director authority:** All knowledge base content and system prompt templates require Medical Director PR approval before merge. This is a TGA SaMD compliance requirement — the Medical Director is the designated clinical authority over all AI clinical content.

**AHPRA constraints are hardcoded, not retrieved:** Regulatory language constraints are injected into every system prompt as a static block, not as a RAG result. This prevents them from being omitted or diluted by retrieval ranking.

**Data sovereignty:** pgvector runs on the existing RDS instance in ap-southeast-2. No knowledge base content leaves Australia during retrieval or indexing.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `rag.retrieval_performed` | RAG query executed; includes query_keywords, top_k_sources, consultation_id (for output traceability) |
| `knowledge_base.updated` | New content merged and re-indexed; includes PR reference and Medical Director approval date |

---

## Acceptance Criteria

- [ ] Licensing status confirmed for eTG, AMH, MIMS — or fallback strategy documented and Medical Director-approved
- [ ] Knowledge base v1 covers 5 GP presentation categories; all content Medical Director-approved
- [ ] AHPRA regulatory language constraints signed off by advertising compliance reviewer
- [ ] pgvector enabled on RDS; knowledge base embedded and indexed
- [ ] RAG retrieval tested on 10 synthetic scenarios; relevant excerpts returned in all 10 cases
- [ ] System prompt templates completed and Medical Director-approved
- [ ] End-to-end RAG pipeline prototype tested; Medical Director blind comparison shows improvement over baseline
- [ ] Branch protection rules active on clinical knowledge repo; Medical Director PR approval required
- [ ] Knowledge base update and governance process documented

---

## Research / Licensing Timeline (starts Week 1, alongside Sprint 0)

| Task | Owner | Deadline |
|------|-------|----------|
| Contact eTG, AMH, MIMS for AI licensing enquiry | CTO | Week 1 |
| AHPRA advertising language constraints — draft | Regulatory Advisor | Week 2 |
| Initial question trees for 5 common presentations | Medical Director | Week 3 |
| Knowledge base v1 content authored (5 categories, PBS meds, escalation) | CTO + Medical Director | Week 4 |
| AHPRA constraints signed off by compliance reviewer | Regulatory Advisor | Week 6 |
| pgvector setup and knowledge base v1 indexed | CTO | Sprint 3 (Week 7) |
| RAG pipeline prototype tested on 10 synthetic consultations | CTO | Sprint 3 (Week 8) |
| Medical Director blind comparison: RAG vs baseline | Medical Director | Sprint 3 (Week 8) |
| Governance workflow documented; branch protection active | CTO | Sprint 3 (Week 8) |

---

## Dependencies

- PRD-001: Medical Director confirmed; clinical prompt Git repository created with branch protection
- PRD-002: Clinical LLM selected (determines which embedding model to use for vector indexing)
- PRD-003: RDS PostgreSQL instance provisioned (pgvector runs on existing instance)

---

## Out of Scope

- All GP presentation categories beyond the initial 5 (Phase 2 backlog)
- Specialty college guidelines (RANZCP, ACD, etc.) — Phase 2
- Telehealth MBS item number integration — Phase 2
- Automated guideline update detection (Phase 2 — Phase 1 is manual update trigger)
- Migration from pgvector to dedicated vector store — Phase 2 if query latency degrades at scale
