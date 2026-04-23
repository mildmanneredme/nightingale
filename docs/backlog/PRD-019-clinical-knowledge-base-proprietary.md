# PRD-019 — Clinical Knowledge Base: Proprietary Source Extensions

> **Status:** Not Started — Phase 2
> **Phase:** Post-Beta (after PRD-011 Phase 1 build is proven in production)
> **Type:** Technical — Clinical AI Infrastructure
> **Owner:** CTO + Medical Director
> **Prerequisite:** [PRD-011 — Clinical Knowledge Base (Phase 1: Open-Source Stack)](PRD-011-clinical-knowledge-base.md) shipped and stable in production

---

## Overview

This PRD extends the Phase 1 RAG knowledge base (PRD-011) with licensed proprietary Australian clinical sources — eTG Complete (Therapeutic Guidelines), the Australian Medicines Handbook (AMH), and MIMS Australia. These sources represent the Australian standard of care for therapeutic management and provide deeper drug-level guidance than is achievable with open-source data alone.

This PRD is intentionally deferred until PRD-011 is live and producing measurable AI output quality baselines. The Phase 1 open-source stack (PBS + RACGP + NHMRC) is sufficient for the MVP and beta consultations. Proprietary source integration adds licensing cost and complexity; the Phase 1 baseline establishes whether and where that investment is clinically warranted.

---

## Background

The Phase 1 knowledge base (PRD-011) uses exclusively freely available sources — PBS medication data, MBS schedule, RACGP clinical guidelines, NHMRC approved guidelines, and SNOMED CT-AU/AMT. This is sufficient to ground the AI engine in Australian prescribing norms, GP presentation management, and AHPRA-compliant language.

However, three authoritative sources remain behind commercial licences and offer depth that the open-source stack cannot replicate:

| Source | Gap Addressed |
|--------|--------------|
| **eTG Complete** (Therapeutic Guidelines Ltd) | Australian standard of care for therapeutic management — condition-specific drug selection rationale, treatment algorithms, and second/third-line options not available in RACGP guidelines or PBS data alone |
| **AMH** (Australian Medicines Handbook) | Drug monographs with AU-specific dosing, interaction profiles, contraindication detail, and patient counselling notes — richer than PBS listing data |
| **MIMS Australia** | Real-time AU drug database with PBS status, TGA approval status, interaction checker data, and product information — widely integrated into Australian clinical software |

The clinical trigger for this PRD is evidence from Phase 1 production that the open-source knowledge base produces AI outputs requiring frequent Medical Director amendment on drug selection, dosing, or interaction reasoning — i.e., where proprietary depth would meaningfully reduce amendment rate.

---

## User Roles & Access

Same as PRD-011 — no changes to governance model.

---

## Functional Requirements

### Licensing & Commercial Agreements

| # | Requirement |
|---|-------------|
| F-001 | Initiate contact with Therapeutic Guidelines Ltd for an AI/programmatic use licence for eTG Complete |
| F-002 | Initiate contact with AMH Pty Ltd for an AI/programmatic use licence |
| F-003 | Initiate contact with MIMS Australia for a commercial AI integration agreement |
| F-004 | Legal review of each licence agreement before signing — confirm permitted use covers: extracting content for vector embedding, use in AI-generated outputs reviewed by a credentialed GP, and any attribution requirements |
| F-005 | If any licence prohibits vector embedding or AI product integration, document whether Medical Director-authored summaries of that source can be used as a compliant proxy |
| F-006 | Licensing status for all three sources resolved and documented before Sprint start |

### Content Integration

| # | Requirement |
|---|-------------|
| F-007 | eTG Complete content ingested per condition category, extending the existing `clinical-knowledge/therapeutic-guidelines/{condition}/` structure |
| F-008 | AMH drug monographs ingested per drug class, extending `clinical-knowledge/medications/` |
| F-009 | MIMS drug database integrated as a structured lookup (interaction data, PBS/TGA status) — approach TBD based on MIMS API availability under licence |
| F-010 | Proprietary content stored in separate sub-directories from open-source content (e.g., `therapeutic-guidelines/etg/`, `medications/amh/`) to enable independent licence auditing |
| F-011 | All proprietary content reviewed and approved by Medical Director before indexing |
| F-012 | Each proprietary knowledge base file includes: source name, licence agreement reference, version/date of source, Medical Director sign-off date |

### RAG Pipeline Updates

| # | Requirement |
|---|-------------|
| F-013 | Proprietary content embedded and indexed into the existing pgvector instance (or successor vector store if migration has occurred) |
| F-014 | Retrieval function updated to weight proprietary eTG/AMH content appropriately relative to open-source RACGP/NHMRC content — tuned by condition category |
| F-015 | RAG pipeline regression tested on the same 10 synthetic consultations used in PRD-011 — outputs with proprietary sources must not regress on Phase 1 quality baselines |
| F-016 | Medical Director blind comparison: proprietary-augmented outputs vs Phase 1 baseline on a set of 20 consultations (10 original + 10 new presentations requiring drug-level reasoning) |

### Content Refresh

| # | Requirement |
|---|-------------|
| F-017 | eTG update process documented: Therapeutic Guidelines Ltd notifies subscribers of updates; CTO proposes re-index PR; Medical Director approves before merge |
| F-018 | AMH update process documented: AMH publishes updates periodically; same PR approval workflow |
| F-019 | MIMS real-time update approach confirmed based on API terms — monthly re-index minimum |

---

## Non-Functional Requirements

- **Licence compliance:** Proprietary content must only be used within the scope of the signed agreements. The system must not expose raw proprietary content to users or third parties — it is used only to ground LLM outputs, which are then reviewed by a GP before release.
- **Auditability:** Each RAG retrieval log must record whether proprietary sources were included in the top-K results (to support licence audit trails).
- **Sovereignty:** All content remains on the existing RDS instance in ap-southeast-2 — no proprietary content leaves Australia.

---

## Go / No-Go Criteria (Before Starting This PRD)

Before initiating this PRD, the following gates must be met:

| Gate | Description |
|------|-------------|
| PRD-011 in production | Phase 1 knowledge base is live and serving at least 50 completed consultations |
| Phase 1 quality baseline established | Medical Director has reviewed AI amendment rates and identified specific clinical areas where depth is insufficient |
| Clinical need confirmed | Amendment rate analysis or Medical Director review confirms that drug-level reasoning is a material failure mode — not just a theoretical gap |
| Budget approved | Licensing costs for eTG, AMH, and/or MIMS approved by founders |

---

## Acceptance Criteria

- [ ] Licence agreements executed for eTG Complete, AMH, and/or MIMS (or fallback strategy documented for any that refuse AI use)
- [ ] Legal review of all licence terms complete
- [ ] Proprietary content ingested, Medical Director-approved, and indexed
- [ ] RAG pipeline regression tested — no quality regression vs Phase 1 baseline
- [ ] Medical Director blind comparison confirms improvement in drug-level reasoning over Phase 1 baseline
- [ ] Licence audit trail confirmed: retrieval logs indicate when proprietary sources are used
- [ ] Content refresh processes documented for each proprietary source

---

## Dependencies

- PRD-011: Phase 1 knowledge base and RAG pipeline shipped and stable
- PRD-012: Clinical AI Engine in production (provides the quality baselines that determine whether this PRD is warranted)

---

## Out of Scope

- Replacing the open-source Phase 1 sources — proprietary sources augment, not replace
- Automated content extraction from eTG/AMH web interfaces without a programmatic licence — must use licensed API or bulk data access
- Specialty college guidelines (RANZCP, ACD, etc.) — separate future PRD if indicated by consultation category expansion
