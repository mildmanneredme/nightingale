# PRD-016 — Beta Launch Readiness

> **Status:** Shipped 2026-04-23 (technical implementation; compliance/operational gates remain)
> **Phase:** Sprint 6 (Week 12–14)
> **Type:** Technical + Operational
> **Owner:** CTO + Founder

---

## Overview

Before the first real patient conducts a consultation, the end-to-end system must be tested, a penetration test completed, Privacy Policy and Collection Notice published, and 100 beta patients onboarded. This PRD covers the readiness gate — the checklist of conditions that must all be satisfied before the beta goes live.

---

## Background

Beta launch is not a soft launch with "we'll fix it later" risk tolerance. Clinical software operating on real patients has a different risk profile. A bug in the consultation booking flow is annoying; a bug in the red flag detection or doctor notification is potentially a patient safety event. The readiness gate exists to prevent launching too early.

The beta cohort is the Medical Director's existing patient network — people who have a pre-existing relationship with the GP and provide an informed, trusting environment for early testing.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Admin / CTO | Runs E2E test scenarios; configures monitoring and alerting; manages beta cohort onboarding |
| Medical Director | Reviews AI output quality across all 5 presentations; signs off all clinical governance items |
| Beta Patients | First 100 real users; recruited from the Medical Director's existing patient network |

---

## Functional Requirements

### End-to-End Testing

| # | Requirement |
|---|-------------|
| F-001 | Full consultation flow tested end-to-end with synthetic patients (not real medical conditions): register → pay → voice interview → photo upload → AI engine → doctor review → patient response → follow-up |
| F-002 | Full text-chat fallback flow tested end-to-end |
| F-003 | Anonymous patient flow tested end-to-end |
| F-004 | Paediatric consultation flow tested (parental consent capture, flag propagation) |
| F-005 | Red flag detection tested: 3 test scenarios (chest pain + SOB, thunderclap headache, suicidal ideation) each trigger 000 instruction |
| F-006 | Doctor rejection flow tested: refund triggered, patient notified |
| F-007 | Follow-up "Feeling worse" flow tested: consultation re-opened in doctor queue |
| F-008 | Payment failure tested: consultation does not proceed; patient can retry |
| F-009 | Email delivery tested in production-like environment (real SendGrid account, not sandbox) |
| F-010 | All 5 clinical presentations tested with Medical Director reviewing AI output quality |

### Penetration Testing

| # | Requirement |
|---|-------------|
| F-011 | External penetration test completed by a CREST-accredited security firm before any real patients are onboarded |
| F-012 | Penetration test scope: patient web app, doctor dashboard, API endpoints, authentication, S3 access controls, audit log integrity |
| F-013 | All critical and high findings from pen test remediated and verified before beta launch |
| F-014 | Medium findings have a documented remediation plan with timeline |
| F-015 | Pen test report retained for regulatory purposes |

### Compliance Gate

| # | Requirement |
|---|-------------|
| F-016 | Privacy Policy published at public URL; linked from registration page |
| F-017 | Collection Notice visible at registration point (before data collection begins) |
| F-018 | All DPAs signed with: SendGrid, Stripe, Twilio, Vapi/Retell.ai, Anthropic (if direct API) or AWS Bedrock confirmed |
| F-019 | TGA pre-submission advice received; SaMD classification confirmed |
| F-020 | AHPRA advertising compliance sign-off obtained on all patient-facing copy |
| F-021 | Medical Director's professional indemnity insurance scope confirmed in writing |
| F-022 | Clinical governance framework signed by Medical Director |
| F-023 | Clinical prompt repository created with Medical Director branch protection active |

### Beta Onboarding

| # | Requirement |
|---|-------------|
| F-024 | 100 beta patients identified from Medical Director's existing patient network |
| F-025 | Beta invitation email explains: what Nightingale is, how the beta works, that a real GP reviews all consultations, privacy approach, and that feedback is welcomed |
| F-026 | Beta patients receive a dedicated support email address for feedback and questions |
| F-027 | Admin dashboard shows: beta patient count, consultation count, approval/amendment/rejection rates |
| F-028 | Feedback collection: post-consultation patient satisfaction survey (3-question, optional; sent in follow-up email) |

### Operational Readiness

| # | Requirement |
|---|-------------|
| F-029 | Incident response runbook documented: what to do if: AI engine fails, doctor queue not clearing, patient reports adverse outcome, data breach detected |
| F-030 | On-call contact established: CTO for technical issues, Medical Director for clinical issues |
| F-031 | Monitoring alerts active: CloudWatch alarms, failed payment rate, queue depth (consultations waiting > 4 hours), SendGrid bounce rate |
| F-032 | Data backup verified: RDS snapshot restored and tested in staging environment |

---

## Compliance Notes

**Launch gate dependency:** All deliverables from PREREQ-001 must be complete before this PRD can be signed off. PREREQ-001 is where compliance work happens; this PRD validates that it is done.

**Penetration testing:** A CREST-accredited firm is required — internal testing does not satisfy this requirement. All critical and high findings must be remediated and re-verified before any real patient creates an account.

**Privacy Policy timing:** The Privacy Policy must be published at a public URL before the registration form goes live — not just before beta invitations are sent.

**No patient safety exceptions at launch gate:** If E2E testing reveals a red flag detection failure or a HITL bypass scenario, beta launch is blocked until the issue is remediated. There is no "ship and monitor" tolerance for clinical safety failures.

**Audit log events:** This PRD introduces no new audit events. It validates end-to-end that all prior audit log implementations are functioning correctly.

---

## Beta Launch Gate Checklist

All items must be checked before the first real patient consultation:

**Technical**
- [ ] End-to-end test (F-001 through F-010) — all passing
- [ ] Penetration test complete; all critical/high findings remediated (F-011–F-015)
- [ ] Monitoring and alerting active (F-031)
- [ ] Backup restoration tested (F-032)

**Compliance**
- [ ] Privacy Policy and Collection Notice published (F-016–F-017)
- [ ] All DPAs signed (F-018)
- [ ] TGA pre-submission advice received (F-019)
- [ ] AHPRA advertising sign-off (F-020)
- [ ] Medical Director indemnity insurance confirmed (F-021)
- [ ] Clinical governance framework signed (F-022)
- [ ] Clinical prompt repository with branch protection active (F-023)

**Operational**
- [ ] Incident response runbook complete (F-029)
- [ ] On-call contacts confirmed (F-030)
- [ ] Beta cohort identified and invitation sent (F-024–F-026)

---

## Success Criteria at End of Beta (Month 6)

| Metric | Target |
|--------|--------|
| Consultations completed | 200 |
| AI draft approval rate (no amendment) | Baseline established |
| Patient satisfaction score | Baseline established |
| Doctor rejection rate | Baseline established |
| Average doctor review time | < 5 min |
| Zero patient safety incidents related to AI error | Required |
| Zero uncontained data breaches | Required |

---

## Dependencies

All 15 prior PRDs must be complete. This PRD represents the integration gate — individual components may be done, but this PRD validates they work correctly together.

---

## Implementation Notes (2026-04-23)

**API (`api/src/routes/admin.ts`):**
- `GET /api/v1/admin/stats` — returns: `patients.total`, full consultation status breakdown, approval/amendment/rejection rates (%), avgReviewMinutes, follow-up sent/responded/better/same/worse counts

**Frontend:**
- `web/src/app/(admin)/beta/page.tsx` — beta launch dashboard with: overview cards (patient count, consultation count, pending queue, avg review time), doctor outcome rates, follow-up outcome breakdown, beta launch gate checklist (technical + compliance + operational)

**Tests:** 2 stats tests added to `admin.test.ts` — empty-DB baseline + rate calculations after seeded consultations

**Compliance/operational gates (not code — blocked on external parties):**
- Penetration test (CREST-accredited firm)
- Privacy Policy & Collection Notice published
- DPAs signed (SendGrid, Stripe, Twilio, Vapi, AWS)
- TGA pre-submission advice
- AHPRA advertising sign-off
- Medical Director indemnity insurance confirmed
- Clinical governance framework signed
- Incident response runbook
- Beta cohort (100 patients) identified & invited

---

## Out of Scope

- Public launch marketing (post-beta)
- Medicare billing integration (Phase 2)
- Additional clinical presentations beyond initial 5 (Phase 2 backlog)
- SEA market entry (Phase 2)
