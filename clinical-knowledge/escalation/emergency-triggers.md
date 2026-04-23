---
source: Nightingale Platform — Emergency Escalation Triggers
authored_by: CTO (technical implementation)
clinical_review: PENDING — Medical Director review required before production use
version: 1.0-DRAFT
category: escalation
md_approved_at: PENDING
status: DRAFT — authored by CTO based on RACGP and ARC guidelines; awaiting Medical Director clinical sign-off
---

# Emergency Escalation Triggers

## Purpose

This document defines the emergency triggers used by the Nightingale AI system to immediately escalate a consultation to emergency services or flag for urgent GP review. These triggers are implemented in the server-side red flag detector (`api/src/services/redFlagDetector.ts`) and must also be communicated clearly to patients in AI-generated responses.

## Tier 1: Immediate Emergency (Call 000)

The AI system must immediately display an emergency alert and instruct the patient to call 000 or go to the nearest emergency department if any of the following are detected:

### Cardiac / Respiratory
- Chest pain combined with difficulty breathing or shortness of breath
- Chest pain with sweating, nausea, or arm/jaw pain (possible myocardial infarction)
- Severe difficulty breathing at rest (possible acute asthmatic attack, pulmonary embolism, or severe pneumonia)

### Neurological
- Thunderclap headache ("worst headache of my life", sudden severe headache) — possible subarachnoid haemorrhage
- Sudden facial drooping, arm weakness, or slurred speech (FAST — Face, Arms, Speech, Time: possible stroke)
- Sudden loss of consciousness, collapse, or unresponsiveness
- New onset seizure in an adult with no known epilepsy

### Allergic / Anaphylaxis
- Throat or tongue swelling, difficulty swallowing or breathing following allergen exposure
- Widespread hives with systemic symptoms (low blood pressure, loss of consciousness)

### Sepsis / Infection
- High fever (above 39°C) with confusion, altered consciousness, or rigors
- Rash with fever and neck stiffness (possible meningococcal disease)
- Non-blanching purpuric or petechial rash

### Mental Health
- Active suicidal ideation with intent or plan
- Expressed intent to harm others

### Other
- Uncontrolled, profuse, or arterial bleeding
- Suspected overdose or poisoning
- Cauda equina syndrome (saddle anaesthesia, sudden bilateral leg weakness, acute loss of bladder/bowel control)

## Tier 2: Urgent GP Review (Within 24 hours)

The AI system should recommend urgent in-person GP review if:
- Fever above 38.5°C in an infant under 3 months
- Symptoms of serious bacterial infection not meeting Tier 1 criteria
- Worsening symptoms after 48 hours of treatment
- New or worsening mental health crisis without acute suicidal risk
- Symptoms consistent with possible deep vein thrombosis (unilateral leg swelling, pain, redness)

## Implementation notes

These triggers are coded as regular expressions in `api/src/services/redFlagDetector.ts`. The CTO is responsible for the technical implementation; the Medical Director must approve the clinical thresholds before production deployment.

Any modification to these triggers requires:
1. CTO review (technical implementation)
2. Medical Director sign-off (clinical thresholds)
3. Version bump and re-approval

## Standard emergency language

All patient-facing emergency messages must use exactly:

> "**Call 000 or go to your nearest emergency department immediately.** Do not drive yourself. Call 000 now."

---
*DRAFT — Technical author: CTO. Clinical accuracy requires Medical Director review and sign-off before this document is used in production AI outputs.*
