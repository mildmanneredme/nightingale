# Open Source & Freely Available Australian Medical Knowledge Sources

> **Status:** Research Complete — April 2026
> **Purpose:** Identify zero-cost knowledge sources to build the clinical AI RAG pipeline before engaging paid vendors (eTG, AMH, MIMS)
> **Companion document:** [2026-04-21-australian-medical-knowledge.md](./2026-04-21-australian-medical-knowledge.md)

---

## Summary

Several high-quality, authoritative Australian clinical knowledge sources are freely available under open licences or free registration. These can form the backbone of the v1 RAG knowledge base — covering medications (PBS), Medicare items (MBS), clinical guidelines (RACGP, NHMRC), and clinical terminology (SNOMED CT-AU, AMT) — without any commercial licensing cost. Paid sources (eTG, AMH, MIMS) should be pursued in parallel for depth of therapeutic reasoning, but are not blockers for a working prototype.

---

## 1. PBS API — Medication Schedule Data

**Source:** [data.pbs.gov.au](https://data.pbs.gov.au) / [info.data.pbs.gov.au/api](https://info.data.pbs.gov.au/api/open-api-v1-0-0/)
**Licence:** Free API key via PBS Developer Portal registration (no cost)
**Maintained by:** Australian Government Department of Health and Aged Care

The PBS API provides programmatic access to the complete PBS Schedule — the full list of Australian Government-subsidised medicines, approved indications, prescribing conditions, pricing, and authority requirements. Updated on the first of every month.

**What it covers:**
- All PBS-listed medications with approved indications and prescribing restrictions
- Authority requirements (streamlined vs. written authority)
- Pricing and patient co-payments
- Prescriber eligibility conditions

**Practical constraints:**
- Rate-limited to 1 request per 20 seconds on the public API (sufficient for batch indexing, not real-time lookups at scale)
- Higher rate limits available via the PBS Developer Program (still free, requires application)
- XML/text file downloads are being discontinued from 1 May 2026 — the API and CSV formats are the only supported formats going forward

**For RAG use:** Bulk-download the monthly schedule CSV, parse into structured records, embed into the vector store. Refresh monthly as part of the knowledge base maintenance cycle.

**Bonus — community MCP server:** An open source MCP server wrapping the PBS API already exists at [github.com/matthewdcage/pbs-mcp-server](https://github.com/matthewdcage/pbs-mcp-server), enabling natural language queries against the PBS directly from Claude. Useful for rapid prototyping; should be evaluated for production suitability.

---

## 2. MBS — Medicare Benefits Schedule Data

**Source:** [mbsonline.gov.au/downloads](https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/downloads) / [data.gov.au](https://data.gov.au/data/dataset/medicare-benefits-schedule-mbs-group)
**Licence:** Open Government Licence (free, attribution required)
**Maintained by:** Australian Government Department of Health and Aged Care

The MBS lists every Medicare-subsidised service, including GP consultations, specialist referrals, telehealth items, pathology, diagnostic imaging, and allied health. Bulk CSV and Excel downloads are available directly from MBS Online and data.gov.au.

**What it covers:**
- Item numbers, service descriptions, and Medicare rebate amounts
- Telehealth MBS items and eligibility conditions (relevant for Phase 2 billing)
- Referral item numbers (GP Management Plans, Team Care Arrangements)
- Allied health item numbers

**For RAG use:** Download the current MBS schedule CSV, parse into a structured look-up table. Use primarily for escalation and referral pathway logic (e.g., "this presentation should trigger MBS item 721 review") rather than as narrative clinical guidance.

---

## 3. SNOMED CT-AU + Australian Medicines Terminology (AMT)

**Source:** [healthterminologies.gov.au](https://www.healthterminologies.gov.au)
**Licence:** Free registration + SNOMED CT Affiliate Licence Agreement + Australian National Terminology Licence Agreement (both free)
**Maintained by:** Australian Digital Health Agency (ADHA) / National Clinical Terminology Service (NCTS)

SNOMED CT-AU is the Australian extension of SNOMED CT — the global standard clinical terminology. It includes the Australian Medicines Terminology (AMT), which provides a nationally standardised, structured representation of all medicines in the Australian market. Updated monthly.

**What it covers:**
- SNOMED CT-AU: clinical concepts, diagnoses, findings, procedures, observable entities — mapped to Australian clinical practice
- AMT: structured medication data including trade product names, generic names, strengths, routes, and forms — linked to PBS listings
- Available as RF2 release files (Full, Snapshot, Delta) and HL7 FHIR ValueSets

**For RAG use:** SNOMED CT-AU provides a controlled clinical vocabulary — useful for normalising symptom and diagnosis terms in the RAG pipeline (e.g., mapping "UTI" → `68566005 | Urinary tract infectious disease`). AMT can complement PBS data with structured medicine attributes. Load into the vector store alongside narrative clinical content.

**Tooling — AuDigitalHealth GitHub:**
ADHA maintains an open source GitHub organisation at [github.com/AuDigitalHealth](https://github.com/AuDigitalHealth) with:
- [sctau-sample-scripts](https://github.com/AuDigitalHealth/sctau-sample-scripts) — SQL scripts for loading SNOMED CT-AU RF2 release files into a relational database
- FHIR implementation guides and clinical document libraries
- Sample code for My Health Record FHIR integration

**CSIRO Ontoserver:** CSIRO's [Ontoserver](https://www.ontoserver.csiro.au/site/) is an Australian-built FHIR terminology server that can syndicate directly from NCTS and serve SNOMED CT-AU lookups over a FHIR API. It is free for non-commercial/research use; production licensing should be verified with CSIRO.

---

## 4. RACGP Clinical Guidelines

**Source:** [racgp.org.au/clinical-resources/clinical-guidelines](https://www.racgp.org.au/clinical-resources/clinical-guidelines)
**Licence:** Freely available; attribution to RACGP required
**Maintained by:** Royal Australian College of General Practitioners

RACGP develops and publishes the authoritative Australian GP clinical guidelines. All are freely downloadable as PDFs from the RACGP website.

**Key publications for Phase 1 RAG knowledge base:**

| Guideline | Relevance |
|-----------|-----------|
| **Red Book (10th edition, 2024)** — *Guidelines for Preventive Activities in General Practice* | Preventive screening, chronic disease management, mental health check-ins, women's health |
| **Smoking, nutrition, alcohol, physical activity (SNAP) guidelines** | Lifestyle counselling — common in telehealth consultations |
| **RACGP diabetes guidelines** | Chronic disease — high telehealth volume |
| **RACGP skin guidelines** | Relevant to skin rash question tree |
| **RACGP musculoskeletal guidelines** | MSK pain — high telehealth volume |

**For RAG use:** Download PDFs, extract narrative text, chunk by condition section, embed into the vector store. The Red Book alone covers the most common preventive care presentations — a strong foundation for Phase 1.

---

## 5. NHMRC Clinical Practice Guidelines

**Source:** [nhmrc.gov.au/guidelines](https://www.nhmrc.gov.au/guidelines)
**Licence:** Freely downloadable under NHMRC Open Access Policy
**Maintained by:** National Health and Medical Research Council

NHMRC approves and publishes evidence-based clinical practice guidelines across a broad range of conditions. All are freely available as PDF downloads.

**Relevant approved guidelines (2024–2025):**
- Australian Evidence-Based Clinical Guidelines for Diabetes
- Australian Postnatal Care Guidelines
- Australian Pregnancy Care Guidelines
- Australian and New Zealand Living Clinical Guidelines for Stroke Management
- Australian Evidence-Based Guideline for Unexplained Infertility

**For RAG use:** Selectively ingest guidelines covering conditions in the Phase 1 question tree scope (respiratory, skin, urological, MSK, mental health). NHMRC guidelines are high-quality, well-structured, and explicitly graded — useful as authoritative backing for differential recommendations.

---

## 6. Digital Health Developer Portal

**Source:** [developer.digitalhealth.gov.au](https://developer.digitalhealth.gov.au)
**Licence:** Free registration
**Maintained by:** Australian Digital Health Agency

The ADHA Developer Portal provides access to FHIR implementation guides, open source sample code, and the National Clinical Terminology Service API. Key assets:

- **FHIR Implementation Guides:** Australian-specific FHIR profiles for clinical documents, medication records, My Health Record — useful if Phase 2 integrates with My Health Record
- **Open Source Code Directory:** GitHub and NuGet packages for FHIR client libraries, clinical document creation, SNOMED CT-AU processing
- **Healthdirect National Health Services Directory (NHSD) API:** Free-registration API providing access to 400,000+ healthcare service and provider records across Australia — useful for building the in-person/specialist referral escalation pathway (i.e., "find a GP near the patient")

---

## 7. AIHW Open Health Data

**Source:** [aihw.gov.au](https://www.aihw.gov.au) / [data.gov.au](https://data.gov.au)
**Licence:** Creative Commons (varies by dataset)
**Maintained by:** Australian Institute of Health and Welfare

AIHW publishes aggregated, de-identified Australian health statistics. Not suitable for clinical reasoning in the RAG pipeline, but useful for calibrating AI outputs (e.g., condition prevalence rates in Australia, GP consultation patterns, chronic disease burden).

---

## Licensing Notes — What "Free Registration" Means

| Source | Registration Required | Cost | AI/Commercial Use |
|--------|----------------------|------|-------------------|
| PBS API | Yes (PBS Developer Portal) | Free | Permitted under Open Government Licence |
| MBS downloads | No | Free | Permitted under Open Government Licence |
| SNOMED CT-AU / AMT | Yes (NCTS + SNOMED Affiliate Licence) | Free | Affiliate Licence must be reviewed for AI product use — check with ADHA |
| RACGP guidelines | No | Free | Attribution required; confirm commercial AI use terms with RACGP |
| NHMRC guidelines | No | Free | Open Access Policy — confirm commercial product use |
| Healthdirect NHSD API | Yes | Free | Review NHSD terms for commercial integration |

**Action required before build:** Confirm that SNOMED CT Affiliate Licence and Australian National Terminology Licence permit embedding AMT/SNOMED content into a commercial AI product's vector store. ADHA's open data programmes are generally permissive, but this should be confirmed in writing before Sprint 4.

---

## Sources That Require Payment (Do Not Initiate Without Licensing Resolved)

For completeness, the following remain behind commercial licences and should be pursued in parallel once budget is confirmed:

| Source | Why Needed | Contact |
|--------|-----------|---------|
| eTG Complete (Therapeutic Guidelines) | Australian standard of care for therapeutic management — the gold standard for drug and condition guidance | Therapeutic Guidelines Ltd |
| AMH (Australian Medicines Handbook) | Drug monographs, dosing, interactions | AMH Pty Ltd |
| MIMS Australia | Drug database, PBS listing status, interactions | MIMS Australia |

---

## Recommended Phase 1 Build Order

Given the above, the recommended sequencing to stand up a working RAG knowledge base using zero-cost sources:

1. **PBS API CSV** — ingest monthly schedule, index into pgvector. Covers all medication references needed for Phase 1.
2. **RACGP Red Book (10th edition)** — extract, chunk, embed. Covers preventive care, screening, and common GP presentations.
3. **SNOMED CT-AU snapshot** — load into a relational reference table (not vector store) for terminology normalisation during the RAG retrieval step.
4. **RACGP condition-specific guidelines** (skin, MSK, respiratory, mental health) — one per Phase 1 question tree.
5. **MBS telehealth items** — structured lookup table for escalation logic.
6. **NHMRC diabetes + mental health guidelines** — complement RACGP coverage for chronic disease presentations.

This stack is buildable in Week 4 of the research timeline without any vendor engagement.
