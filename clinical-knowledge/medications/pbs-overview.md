---
source: Australian Government Department of Health and Aged Care — Pharmaceutical Benefits Scheme (PBS); Services Australia — PBS Item Codes; NPS MedicineWise PBS Information
source_url: https://www.pbs.gov.au/
version: 2024
category: medications
md_approved_at: PENDING — awaiting Medical Director review
status: PLACEHOLDER — PBS prescribing information placeholder. Full PBS CSV ingestion pipeline (F-012) will replace this with structured per-drug data.
---

## PBS Overview

The Pharmaceutical Benefits Scheme (PBS) provides subsidised access to a wide range of medicines for Australian residents and eligible visitors. PBS medicines are listed on the Schedule of Pharmaceutical Benefits (the Schedule), updated quarterly. Understanding PBS prescribing rules is a core clinical skill for Australian GPs.

## Key PBS Concepts

**Benefit categories:**
- **Unrestricted (PBS General)**: any patient with a valid Medicare card can receive subsidy for a medical condition consistent with the approved indication; no restriction on prescribing
- **Restricted Benefit**: subsidised for specific clinical indications only; prescriber must indicate the relevant condition; patient statement or prescriber endorsement not required for most items
- **Authority Required (Streamlined Authority)**: requires an authority approval number from Services Australia; some streamlined authorities are available via online prescribing software (PRODA/Online PBS Authorities); others require telephone application (1800 888 333)
- **Authority Required (Written)**: full written authority application to Services Australia with clinical justification; applies to high-cost biologics (dupilumab, adalimumab, natalizumab etc.)

**Co-payment and safety net (2024):**
- General patients: up to approximately $31.60 per script (2024 figure; indexed annually)
- Concession card holders: up to approximately $7.70 per script (PBS concessional co-payment)
- PBS Safety Net: once total OOP PBS spending exceeds the annual threshold, further PBS medicines are free (concession) or at concessional rate (general) for the remainder of the calendar year
- Register family/household for safety net: combined household PBS spending counts toward threshold

**Prescription requirements:**
- PBS prescriptions must include: prescriber details (name, address, prescriber number), patient details, drug name (generic preferred), strength, form, quantity, repeats, date
- Quantity and repeats: limited by PBS Schedule; do not exceed Schedule quantity
- Brand substitution: pharmacist may substitute PBS medicines with equivalent brand unless "brand substituted – not permitted" marked; clinically equivalent brands listed on Schedule

## Key PBS Schedule Categories Relevant to GP Practice

**Cardiovascular medicines:**
- Statins (atorvastatin, rosuvastatin, pravastatin): PBS unrestricted for hyperlipidaemia
- ACE inhibitors, ARBs: PBS unrestricted for hypertension and heart failure
- Warfarin, DOACs (apixaban, rivaroxaban, dabigatran): PBS restricted for atrial fibrillation and VTE; Authority for some indications
- Digoxin, amiodarone: PBS restricted

**Diabetes medicines:**
- Metformin: PBS unrestricted for type 2 diabetes
- SGLT2 inhibitors (empagliflozin, dapagliflozin): PBS Authority for T2D; Authority for CKD/heart failure indications
- GLP-1 agonists (semaglutide/Ozempic, dulaglutide/Trulicity): PBS Authority for T2D; NOT PBS-listed for obesity alone (as of 2024 — check schedule updates)
- Insulin: PBS restricted; multiple formulations; NDSS-registered patients may access subsidised consumables

**Mental health medicines:**
- SSRIs (sertraline, escitalopram, fluoxetine): PBS restricted for depression and anxiety
- SNRIs (venlafaxine, duloxetine): PBS restricted for depression; venlafaxine for anxiety
- Antipsychotics (risperidone, quetiapine, olanzapine, clozapine): PBS restricted; Authority for schizophrenia and bipolar disorder
- Stimulants (methylphenidate, dexamphetamine): Schedule 8; PBS Authority; specialist initiation for ADHD

**Biologics and specialty medicines (high-cost, Authority required):**
- TNF inhibitors (adalimumab/Humira, etanercept): PBS Authority for RA, PsA, AS — rheumatologist/specialist initiation
- Dupilumab (Dupixent): PBS Authority for moderate-severe atopic dermatitis ≥6 years; specialist initiation
- Natalizumab (Tysabri), ocrelizumab (Ocrevus), cladribine (Mavenclad): PBS Authority for MS; neurologist initiation
- Buprenorphine-naloxone (Suboxone): PBS restricted; opioid dependence; WARATAH/pharmacist-dispensed or injected formulations
- Nirsevimab (Beyfortus): RSV prophylaxis for infants; check NIP/PBS schedule for current funding status

## PBS Prescribing Platform

**Online PBS Authorities (PRODA):**
- Most streamlined authorities now obtained via online prescribing software through PRODA
- Available in major GP clinical software (Best Practice, Medical Director, Genie)
- Real-time approval; no telephone call required for most streamlined items
- Complex written authorities: submitted electronically or by fax

**MIMS and Therapeutic Guidelines:**
- Standard references for Australian prescribers
- Available through GP software or NPS MedicineWise (nps.org.au)

## Safety and Quality Use of Medicines

**Quality Use of Medicines (QUM) principles:**
- Judiciously select medicines (is a medicine the best option?)
- Appropriate choice (correct drug, dose, route, duration, patient)
- Safe and effective use (adherence, monitoring, interaction checking)
- NPS MedicineWise resources: nps.org.au — consumer and prescriber education

**Prescription monitoring:**
- SafeScript (Victoria — mandatory) and equivalent state programs: real-time prescription monitoring for Schedule 8 drugs (opioids, benzodiazepines); mandatory check before prescribing S8 in applicable states

---

## Data Ingestion Note

This file is a placeholder for the F-012 PBS Medicines CSV ingestion pipeline. When the pipeline is operational, this overview file provides general PBS context while structured per-drug PBS data (item codes, restrictions, authority text, PBS prices) is sourced from the PBS Schedule CSV and stored as separate knowledge chunks per drug class.

*PLACEHOLDER CONTENT — This summary is a placeholder based on publicly available PBS information from Services Australia. It must be reviewed and approved by the Medical Director before use in clinical AI outputs.*
