# PREREQ-001 — Regulatory & Legal Prerequisites

> **Status:** Not Started
> **Phase:** Pre-Build (Before Week 1)
> **Document type:** Pre-build prerequisite checklist — no code deliverables; gates all build sprints
> **Owner:** Founder + Regulatory Advisor

---

## Overview

Before writing a single line of code, Nightingale must engage legal and regulatory advisors, confirm its clinical governance structure, and complete foundational compliance work. These are not optional steps — operating an AI-assisted telehealth service without this groundwork exposes the business to TGA enforcement action, AHPRA complaints, Privacy Act breaches, and unlimited personal liability.

This document tracks the non-technical deliverables that gate the build. It is not a PRD — there is no code to ship. It is a compliance checklist that must be completed in parallel with Sprint 0.

---

## Background

### TGA — Software as a Medical Device (SaMD)

Nightingale's clinical AI engine likely qualifies as a **Software as a Medical Device (SaMD)** under TGA regulations. The recommended classification is **Class IIa SaMD** — clinical decision support software used in conjunction with a clinician (HITL architecture keeps it in decision-support, not autonomous-diagnostic, category).

TGA pre-submission advice is required before launch. Operating without TGA compliance is a criminal offence.

### AHPRA — Advertising Rules

The Medical Director's AHPRA registration means all advertising of Nightingale's services is subject to AHPRA advertising guidelines. Specific constraints:
- Use "assess" not "diagnose"
- Use "recommend" not "prescribe"
- No patient outcome testimonials
- No success rate claims
- Disclaimers required in all consumer-facing content

### Privacy Act — Australian Privacy Principles (APPs)

Health information is "sensitive information" under the Privacy Act. Key requirements:
- Privacy Policy and Collection Notice must be visible at point of data collection
- Cross-border disclosure obligations (APP 8) apply when patient data leaves Australia (to Stripe, SendGrid, Vapi/Retell, Twilio)
- Data Processing Agreements (DPAs) required with all overseas vendors handling health data
- Mandatory breach notification within 30 days (Notifiable Data Breaches scheme)
- Health records retained minimum 7 years

### Clinical Governance

The Medical Director bears clinical liability for all approved consultations. A clinical governance framework must be established before the first patient consultation is conducted.

---

## Deliverables

### Legal & Regulatory

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | TGA pre-submission advice | Engage TGA for formal guidance on SaMD classification and pathway. Estimated cost: $5,000–$15,000 lawyer fees |
| 2 | TGA SaMD registration plan | Document the path to Class IIa registration, timelines, and required technical file |
| 3 | AHPRA advertising compliance review | Engage AHPRA-specialist reviewer to sign off on all patient-facing copy before launch |
| 4 | Privacy Policy | Compliant with APPs; covers data collection, use, storage, overseas disclosure, retention, and deletion |
| 5 | Collection Notice | Short-form notice displayed at point of data collection (registration page) |
| 6 | OAIC registration | Register with the Office of the Australian Information Commissioner |
| 7 | Data Processing Agreements | DPAs executed with: Stripe, SendGrid, Twilio, Vapi/Retell.ai, Anthropic (if direct API) |
| 8 | My Health Record consent flow | Design opt-in consent mechanism for future MHR integration (Phase 2) |

### Clinical Governance

| # | Deliverable | Description |
|---|-------------|-------------|
| 9 | Medical Director confirmed | AHPRA-registered GP, clinic owner, equity + revenue share agreement signed |
| 10 | Professional indemnity insurance confirmed | Explicit confirmation policy covers AI-assisted telehealth consultations |
| 11 | Clinical governance framework | Written framework covering: incident reporting, adverse event process, AI output audit schedule, escalation pathways |
| 12 | Clinical prompt repository setup | Git repo for question trees and clinical AI prompts, with Medical Director approval required for all merges |
| 13 | Initial clinical prompt review | Medical Director reviews and approves initial question trees for 5 common presentations before Sprint 2 |

---

## Acceptance Criteria

- [ ] TGA pre-submission advice received in writing
- [ ] AHPRA advertising compliance sign-off obtained
- [ ] Privacy Policy and Collection Notice drafted and reviewed by lawyer
- [ ] OAIC registration complete
- [ ] DPAs executed with all overseas vendors handling health data
- [ ] Medical Director confirmed with signed agreement
- [ ] Professional indemnity insurance scope confirmed in writing
- [ ] Clinical governance framework document signed by Medical Director
- [ ] Clinical prompt Git repository created with branch-protection rule requiring Medical Director approval
- [ ] Initial question trees for 5 presentations reviewed and approved by Medical Director

---

## Estimated Timeline

8–12 weeks for legal engagements to produce advice (can run in parallel with Sprint 0–1 build). All items must be complete before beta patient onboarding (Sprint 6).

---

## Dependencies

- None — this document has no upstream dependencies and gates everything else.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TGA classifies product as Class IIb or III (stricter) | Low | High | Engage regulatory lawyer before any build; HITL architecture is the key mitigant |
| Medical Director candidate won't confirm insurance scope | Medium | High | Engage broker early; may need to find alternate partner |
| DPA negotiation with Anthropic stalls | Medium | Medium | Use AWS Bedrock (Anthropic models) as fallback — keeps AI processing in Australia, no cross-border DPA needed |
| OAIC registration delayed | Low | Low | Register early; no approval needed, just notification |
