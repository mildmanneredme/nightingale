# SEC-005 — Renewal Business Logic Integrity

> **Status:** Not Started
> **Phase:** Security Hardening — Sprint 7
> **Type:** Security / Clinical Governance — Business Logic
> **Priority:** P1 — Fix before renewals are used with real patients
> **Owner:** CTO + Medical Director
> **Covers audit findings:** SEC-011 (Source consultation not enforced), SEC-012 (Valid period no maximum)

---

## Overview

Two gaps in the script renewal workflow allow patients to request renewals for medications with no prior Nightingale prescription, and allow doctors to approve renewals with an arbitrarily long validity period. Both undermine the clinical governance intent of the renewals feature: that Nightingale only renews what it has previously prescribed, and that renewal durations comply with Australian prescribing standards.

---

## Background

The PRD-018 design specifies that renewals are only available for medications *previously recommended by a Nightingale doctor*. This restriction is enforced by a warning in the UI and a doctor review step, but is not enforced at the API level. Similarly, the prescription validity period is a clinical decision governed by Australian prescribing standards — the system should enforce a maximum duration to prevent accidental or negligent over-approval. Both fixes require Medical Director input on the specific rules before implementation.

---

## Issue 1 — Source Consultation Not Required or Validated

### Description

`POST /api/v1/renewals` accepts a `sourceConsultationId` parameter that is entirely optional. A patient can submit a renewal for any medication they type, with no link to a prior Nightingale consultation. When `sourceConsultationId` is provided, the API verifies the consultation belongs to the patient and has an approved or amended status, but does not verify the requested medication matches what was recommended in that consultation.

### Impact

Doctors reviewing renewal requests cannot distinguish between a legitimate renewal of a Nightingale-prescribed medication and a patient requesting a renewal for a medication they've never discussed with Nightingale. The doctor queue doesn't surface a warning when no source consultation is present. A doctor approving a renewal without a prior Nightingale prescription is outside the defined clinical scope, creates regulatory exposure, and undermines the data integrity of the renewal audit trail. If Nightingale's AHPRA registration is ever audited, approvals without traceable prior prescriptions could be a compliance finding.

### Proposed Fix

**Option A (Strict):** Make `sourceConsultationId` required. Return 400 if not provided. Validate the medication name in the renewal request matches the medication recommendation in the source consultation (fuzzy match or substring, to account for brand/generic name variation). Medical Director must define the matching tolerance.

**Option B (Permissive with warning):** Keep `sourceConsultationId` optional but surface a prominent warning in the doctor renewal queue when it is absent: *"No prior Nightingale consultation linked — doctor must verify prior prescription independently before approving."* Add a `no_prior_prescription_warning` boolean to the renewal queue API response.

**Recommendation:** Implement Option B for the beta. Option A requires establishing the medication matching logic (brand vs. generic, dosage tolerance) which needs Medical Director sign-off. The warning approach ensures doctors are never silently approving without awareness, while avoiding the risk of legitimate renewals being blocked by imperfect string matching.

---

## Issue 2 — Renewal Valid Period Has No Maximum

### Description

`POST /api/v1/renewals/:id/approve` accepts a `validDays` integer with no server-side upper bound (default: 28 days). A doctor can set `validDays: 3650` (10 years) intentionally or by typo. The system will store this, set `valid_until` 10 years from now, and the 48-hour expiry alert will never fire.

### Impact

A renewal valid for an excessive period creates several problems:
1. The patient believes they have an indefinitely valid prescription when in reality Nightingale's renewal is not a formal eScript and has no legal prescribing force beyond what the doctor's own system records.
2. The 7-day patient reminder and 48-hour doctor queue alert systems never trigger, removing the safety-net mechanism for patients who need to stay on long-term medication.
3. From a clinical governance standpoint, most Australian Schedule 4 (prescription-only) medications should not be renewed for more than 12 months without a review. Allowing arbitrary durations exposes Nightingale to regulatory criticism.

### Proposed Fix

Enforce a server-side maximum on `validDays`. The Medical Director must define the maximum per medication class (e.g. 28 days for acute medications, 90 days for stable chronic conditions). For the initial implementation, apply a single global maximum until per-medication-class rules are defined:

**Proposed global maximum: 90 days** (covers most long-term medication renewal scenarios without allowing unreasonable extensions)

Return HTTP 400 with a descriptive error if `validDays` exceeds the maximum. The doctor's UI should communicate the allowed range clearly.

**Open decision — required before implementation:**

| Question | Owner | Required By |
|----------|-------|-------------|
| What is the maximum valid period per medication class for Nightingale renewals? | Medical Director | Sprint 7 start |

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | When `sourceConsultationId` is absent, the doctor renewal queue response includes `noPriorPrescriptionWarning: true` for that renewal |
| F-002 | The doctor renewal UI renders a visible warning banner when `noPriorPrescriptionWarning` is true |
| F-003 | When `sourceConsultationId` is present, the API validates it belongs to the requesting patient and is in an approved or amended status |
| F-004 | `POST /api/v1/renewals/:id/approve` validates that `validDays` does not exceed the configured maximum (default: 90) |
| F-005 | Exceeding the maximum `validDays` returns HTTP 400 with message: "Valid period cannot exceed [max] days. Contact the Medical Director to extend this limit." |
| F-006 | Maximum valid days is configurable via environment variable `RENEWAL_MAX_VALID_DAYS` (default: 90) |
| F-007 | Audit log for `renewal.approved` includes `valid_days` and `max_valid_days` in metadata |
| F-008 | Integration tests cover: renewal with no source consultation shows warning flag, renewal approval with `validDays` > max returns 400, renewal approval at exactly max succeeds |

---

## Compliance Notes

**Prescribing authority:** The Medical Director's sign-off on the maximum valid period is required before this PRD ships. The 90-day default is a placeholder — the Medical Director must approve the final value. This is noted as a pre-production gate.

**Audit trail:** The `validDays` value in the audit log ensures renewals can be reviewed retrospectively for compliance with prescribing duration standards.

---

## Acceptance Criteria

- [ ] Medical Director has confirmed maximum valid period (pre-build gate)
- [ ] `POST /api/v1/renewals` with no `sourceConsultationId` succeeds but returns a `noPriorPrescriptionWarning` flag
- [ ] Doctor renewal queue response includes `noPriorPrescriptionWarning: true` for renewals without a source consultation
- [ ] `validDays: 91` (when max is 90) returns 400
- [ ] `validDays: 90` succeeds
- [ ] `RENEWAL_MAX_VALID_DAYS` env var overrides the default
- [ ] TypeScript check passes

---

## Dependencies

- PRD-018: Script Renewal Workflow (routes being patched)
- Medical Director sign-off on maximum valid period

---

## Out of Scope

- Automated medication name matching between renewal and source consultation (Phase 2 — requires Medical Director-defined matching rules)
- Per-medication-class valid period maximums (Phase 2 — requires Medical Director configuration schema)
- Formal eScript integration (PRD-019 / Phase 2)
