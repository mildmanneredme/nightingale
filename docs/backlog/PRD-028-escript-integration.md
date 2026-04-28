# PRD-028 — eScript Integration

> **Status:** Not started
> **Phase:** Phase 2 — post-beta
> **Type:** Technical — Clinical / Prescribing
> **Priority:** P3 — significant clinical value but requires regulatory groundwork and a prescribing API agreement; cannot ship before beta validates demand
> **Owner:** CTO + Medical Director
> **Depends on:** PRD-013 (Doctor Review Dashboard), PRD-018 (Script Renewals), PREREQ-001 (regulatory and legal prerequisites)

---

## Overview

When a doctor approves a Nightingale consultation and the appropriate treatment includes a medication, they currently have two options: write prescription text in the draft response (plain text, no clinical authority), or issue a script through their own external prescribing system (Fred Dispense, Best Practice, MedicalDirector) and communicate the outcome to the patient separately.

Neither path is good: plain-text prescription information carries no clinical standing, and using an external system breaks the consultation workflow entirely. This PRD adds eScript issuance directly from the doctor review dashboard — the doctor can generate a PBS-compliant electronic prescription for approved medications, which is transmitted to a dispense-ready pharmacy network, with a token sent to the patient by SMS and email.

---

## Background

### Current state

The `consultation_result` page renders a `consultation.prescription` field if populated — this is free-text included in the doctor's draft response. The `infra/database/migrations/010_renewals.sql` comment is explicit: *"eScript issuance is out of scope for Phase 1 — the doctor handles actual prescription issuance via their own prescribing system."*

The script renewals workflow (PRD-018) handles repeat prescriptions but equally defers actual eScript generation to external systems.

### Why this matters commercially

Without eScript, Nightingale is an advice-and-referral service, not a treatment-capable service. Competitors like Instant Scripts built entire businesses on script issuance alone. For UTI, URTI, and skin condition presentations — three of the five MVP categories — a significant proportion of consultations will result in a recommendation for a PBS-listed medication. Without eScript:

- Patients must visit a physical GP solely to convert advice into a script
- The core "consult resolved in one interaction" promise is broken for medication-requiring cases
- Doctors cannot complete the clinical episode within Nightingale

eScript issuance also unlocks the script renewal revenue line properly — renewals (PRD-018) today track the request but do not generate a script.

### eScript infrastructure in Australia

Australia's National E-Prescribing Infrastructure is operated by the Australian Digital Health Agency (ADHA). Two compliant prescribing platforms are available for integration:

| Platform | Notes |
|----------|-------|
| **Fred Dispense** | Widely used by Australian pharmacies; Fred IT Group provides an API for digital health platforms |
| **ScriptPad** (eRx network) | eRx is the leading prescription exchange network; ScriptPad is their prescribing integration product |

Both platforms connect to the national eRx Script Exchange or MediSecure network. A formal API agreement and conformance testing with the chosen platform is required — this is the primary timeline driver for this PRD.

The Medical Director's prescriber number (PBS prescriber identifier) is required on every generated script. For a multi-doctor platform, each approving doctor must have their prescriber number registered.

### Regulatory requirements for electronic prescriptions

Electronic prescriptions in Australia are governed by the Therapeutic Goods Administration and the relevant State/Territory Health Records legislation. Key requirements:

- Must conform to the **Australian Digital Health Agency's Electronic Prescribing Specification**
- Must include: prescriber's name, AHPRA number, PBS prescriber number, practice address
- Must include: patient name, date of birth, Medicare number (if identified patient)
- Anonymous patients **cannot receive PBS-subsidised prescriptions** (Medicare number required for PBS); private script at full cost is permitted
- Controlled drugs (Schedule 8) require additional prescriber authority — not in Phase 2 scope
- Prescribing must be done by the approving doctor (not the AI); the system must enforce this

---

## User Roles & Access

| Role | Access |
|------|--------|
| Doctor (approved) | Issues eScript from the review dashboard during or after approving a consultation; provides prescriber number at onboarding |
| Patient (identified) | Receives eScript token via SMS and email; can present to any connected pharmacy; PBS subsidy applies |
| Patient (anonymous) | Receives private prescription only; no PBS subsidy; Medicare number is absent |
| Admin | Cannot issue or modify prescriptions; can view audit log of script issuance |
| System | Transmits prescription data to Fred Dispense / eRx network; receives confirmation token |

---

## Functional Requirements

### Doctor Prescribing Workflow

| # | Requirement |
|---|-------------|
| F-001 | Doctor review UI includes a "Generate eScript" action, available after the consultation is approved or amended |
| F-002 | Prescribing form collects: medication name (PBS-listed lookup), strength, quantity, number of repeats (0–5), dosage instructions (free text), indication (optional), prescriber notes (optional) |
| F-003 | Medication lookup is constrained to the PBS schedule — doctor cannot prescribe a drug not listed on the PBS (for PBS subsidy); private scripts are permitted for non-PBS drugs but clearly labelled |
| F-004 | If patient is anonymous (no Medicare number), the UI presents a warning: "This prescription will be issued as a private (non-PBS) script. The patient will pay full price." Doctor must confirm before proceeding |
| F-005 | Schedule 8 (controlled drug) items are blocked in Phase 2; the prescribing form must filter these from the PBS lookup |
| F-006 | Doctor reviews and confirms all script details before submission; the confirmation screen displays the full draft script in the standard AU format |
| F-007 | On confirmation, script is transmitted to the eScript platform (Fred Dispense / ScriptPad API) |
| F-008 | On successful issuance, a dispense token is returned and stored against the consultation |
| F-009 | eScript issuance is logged to the audit trail with: doctor ID, AHPRA number, PBS prescriber number, medication, quantity, repeats, patient ID, dispense token |

### Patient Delivery

| # | Requirement |
|---|-------------|
| F-010 | Dispense token delivered to patient via SMS (PRD-027) and email |
| F-011 | Patient email includes: medication name, quantity, instructions, dispense token (QR code or alphanumeric), and instruction on how to present at pharmacy |
| F-012 | Token is valid at any pharmacy connected to the national eRx network |
| F-013 | Patient can view their active eScripts in the app alongside their consultation result |

### Script Renewals Integration

| # | Requirement |
|---|-------------|
| F-014 | Script renewals (PRD-018) are updated to generate a real eScript on doctor approval, not just record approval in the DB |
| F-015 | Renewal eScript links back to the original consultation via source_consultation_id (already tracked in renewals table) |

### Doctor Prescriber Number

| # | Requirement |
|---|-------------|
| F-016 | Doctor onboarding (PRD-025) is extended to capture PBS prescriber number |
| F-017 | Prescriber number validated against PBS prescriber register before a doctor is permitted to issue scripts |
| F-018 | Each generated script includes the approving doctor's prescriber number — not the Medical Director's number if a different doctor approved |

---

## Non-Functional Requirements

- **API agreement:** Fred Dispense or eRx/ScriptPad API agreement must be signed before any development begins — this gates the sprint
- **Conformance testing:** eScript platform may require conformance testing against the ADHA electronic prescribing specification before production access is granted; allow 4–8 weeks
- **Latency:** Script issuance should complete within 10 seconds of doctor confirmation; timeout and retry logic required
- **Audit immutability:** eScript events are appended to the audit log and cannot be modified; any cancellation or voiding is a new event

---

## Compliance Notes

**PBS prescribing authority:** Scripts must be issued by a registered prescriber (doctor with valid AHPRA registration and PBS prescriber number). The system must prevent script issuance if the approving doctor does not have a prescriber number on record.

**AHPRA:** Electronic prescriptions are part of the clinical episode for which the doctor bears professional liability. The audit trail linking script to doctor to consultation is medicolegal evidence.

**Privacy Act:** Patient name, date of birth, and Medicare number appear on PBS prescriptions. This is consistent with existing consultation data handling. The eScript platform (Fred Dispense / ScriptPad) will become a new data processor — DPA required (PREREQ-001 extension).

**Schedule 8 exclusion:** Controlled drugs require additional state-based prescriber authorities. Blocking Schedule 8 entirely in Phase 2 is the safest path; revisit in Phase 3 with legal sign-off.

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `prescription.issued` | eScript transmitted and token received; includes doctor_id, ahpra_number, prescriber_number, medication, consultation_id, dispense_token |
| `prescription.delivery_sent` | Dispense token sent to patient via SMS and email |
| `prescription.api_error` | eScript platform returned an error; includes error code and consultation_id |

---

## Acceptance Criteria

- [ ] Doctor can select a PBS-listed medication and issue an eScript from the review dashboard
- [ ] Patient receives dispense token via email and SMS within 60 seconds of issuance
- [ ] Anonymous patient: UI warns about private script and no PBS subsidy; doctor must confirm
- [ ] Schedule 8 medications are absent from the prescribing lookup
- [ ] Script includes doctor's AHPRA number and PBS prescriber number
- [ ] eScript issuance event written to audit log with all required fields
- [ ] Script renewal approval (PRD-018) generates a real eScript via the same pathway
- [ ] Fred Dispense / ScriptPad API agreement signed before development begins
- [ ] ADHA conformance testing complete before production enablement

---

## Pre-Development Gates (must resolve before sprint planning)

- [ ] Select eScript platform: Fred Dispense or ScriptPad — evaluate API maturity, AU pharmacy network coverage, integration timeline, and cost
- [ ] Execute API agreement with chosen platform
- [ ] Confirm ADHA conformance testing timeline and requirements
- [ ] Healthcare lawyer confirms prescribing liability model for multi-doctor platform (each approving doctor's prescriber number vs Medical Director's)
- [ ] PBS prescriber number field added to doctor onboarding (PRD-025 extension)

---

## Dependencies

- PRD-013: Doctor review dashboard (eScript action added to review UI)
- PRD-018: Script renewals (renewal approval extended to generate real eScript)
- PRD-025: Doctor onboarding (prescriber number captured at onboarding)
- PRD-027: SMS notifications (dispense token delivery)
- PREREQ-001: eScript platform DPA signed; healthcare lawyer signs off prescribing liability model

---

## Out of Scope

- Schedule 8 (controlled drug) prescriptions
- Private hospital prescriptions
- Specialist-only medications requiring authority prescriptions
- Prescription cancellation or voiding (Phase 3)
- Integration with patient's My Health Record prescription view (Phase 3)
- Automatic dosage recommendations from the AI (doctor enters dosage manually)
