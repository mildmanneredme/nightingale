# PRD-007 — Payments & Consultation Booking

> **Status:** Not Started
> **Phase:** Sprint 1 (Week 3–4)
> **Type:** Technical — Payments
> **Owner:** CTO

---

## Overview

Patients pay before a consultation starts. Payment is the gate to the AI interview. If a doctor rejects a consultation (cannot assess remotely), the charge is waived and refunded. The payment model must support both identified and anonymous patients.

---

## Background

### Pricing Model (Phase 1)
- Per-consultation fee: **~$50 AUD**
- Doctor revenue share: **30%** of consultation fee (~$15/consult)
- Payment charged at consultation start (before AI interview)
- Refund policy: full refund if GP cannot complete remote assessment (rejection)

### Stripe as Payment Provider
Stripe is the chosen payment provider. Key considerations:
- Stripe data (cardholder info, transaction records) processed on Stripe's servers outside Australia; DPA with Stripe required (PRD-001)
- Stripe webhooks must be signed and verified before processing
- Patient-facing card UI should use Stripe Elements (PCI scope reduction)

---

## Functional Requirements

### Consultation Booking

| # | Requirement |
|---|-------------|
| F-001 | "Start New Consultation" button is the primary patient CTA; requires active account and verified email |
| F-002 | Before payment, patient sees: consultation fee ($50 AUD), what the consultation includes, and refund policy |
| F-003 | Patient selects their preferred consultation mode: voice (default) or text-chat |
| F-004 | Patient states their chief complaint (free text, 10–200 characters) before payment |
| F-005 | Chief complaint and consultation mode are stored in the consultation record before payment is initiated |

### Payment Flow

| # | Requirement |
|---|-------------|
| F-006 | Payment collected via Stripe payment intent; card details entered via Stripe Elements (never touch Nightingale servers) |
| F-007 | Charge is captured at consultation start (not authorisation-only) |
| F-008 | Payment confirmation email sent by Stripe; Nightingale sends separate consultation confirmation email |
| F-009 | Payment event (success, failure, Stripe payment intent ID) logged to audit trail |
| F-010 | Failed payment: patient shown clear error message; consultation record remains in "unpaid" state; no consultation proceeds |
| F-011 | Anonymous patients can pay by card without providing name or Medicare number |

### Refund Policy

| # | Requirement |
|---|-------------|
| F-012 | Full refund triggered automatically when doctor selects "Reject — cannot assess remotely" |
| F-013 | Refund processed via Stripe refund API within 24 hours of rejection |
| F-014 | Patient notified of refund by email; estimated return timeframe included (3–5 business days) |
| F-015 | Refund event logged to audit trail with: consultation ID, doctor ID, AHPRA, reason code |

### Doctor Revenue Share

| # | Requirement |
|---|-------------|
| F-016 | Revenue share calculation: 30% of $50 = $15 per completed consultation |
| F-017 | Doctor revenue tracked in database by doctor ID and consultation ID |
| F-018 | Monthly revenue share statement emailed to doctor (manual process at MVP; automated in Phase 2) |
| F-019 | No revenue share paid for rejected consultations (no charge to patient) |

---

## Non-Functional Requirements

- **PCI compliance:** Stripe Elements ensures no card data touches Nightingale servers; no PCI SAQ D required
- **Webhook security:** Stripe webhook signature verification on every event
- **Idempotency:** Payment processing must be idempotent (Stripe idempotency keys on all requests)

---

## Consultation State Machine

```
unpaid
  → payment_failed       (payment failed; patient can retry)
  → payment_pending      (Stripe payment processing)
  → paid                 (payment confirmed; AI interview can begin)
      → in_progress      (AI interview active)
      → submitted        (transcript + photos submitted to doctor queue)
          → doctor_reviewing  (doctor has opened the consultation)
              → approved       (patient notification triggered)
              → amended        (doctor edited draft; patient notification triggered)
              → rejected       (refund triggered; patient notified)
                  → refunded   (Stripe refund confirmed)
          → follow_up_sent     (24–48hr follow-up email sent)
              → follow_up_concerning  (patient response flagged; re-opened for doctor)
```

---

## Acceptance Criteria

- [ ] Patient can complete payment for a $50 AUD consultation using a test Stripe card
- [ ] Payment failure leaves consultation in "unpaid" state; AI interview does not start
- [ ] Payment event (amount, Stripe payment intent ID, timestamp) appears in audit log
- [ ] Doctor rejection triggers Stripe refund API call within 24 hours
- [ ] Patient receives refund notification email
- [ ] Stripe webhook payloads verified with signature before processing
- [ ] Anonymous patient can pay without providing name or Medicare number
- [ ] Revenue share calculation (30%) recorded per consultation in the database

---

## Dependencies

- PRD-003: Infrastructure (Stripe webhook endpoint requires deployed service)
- PRD-004: Auth (consultation is tied to authenticated patient account)
- PRD-005: Audit log must capture payment events
- PRD-006: Patient profile (consultation pre-fills from profile; chief complaint captured at booking)

---

## Out of Scope

- Subscription billing (Phase 2)
- Medicare bulk billing (Phase 2)
- Automated monthly payroll for doctors (Phase 2; manual statement at MVP)
- Multi-currency / SEA pricing (Phase 2)
- Discount codes / referral credits (Phase 2)
