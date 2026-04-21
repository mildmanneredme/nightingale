# PRD-016 — Beta Launch Readiness

> **Status:** Not Started
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

## Out of Scope

- Public launch marketing (post-beta)
- Medicare billing integration (Phase 2)
- Additional clinical presentations beyond initial 5 (Phase 2 backlog)
- SEA market entry (Phase 2)
