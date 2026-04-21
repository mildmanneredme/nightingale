# PRD-014 — Patient Notifications

> **Status:** Not Started
> **Phase:** Sprint 5 (Week 10–12)
> **Type:** Technical — Notifications
> **Owner:** CTO

---

## Overview

Patients receive email notifications at key points in the consultation lifecycle. The most important is the delivery of the doctor's response — the core product deliverable. All notifications are email-first at MVP. SMS is optional infrastructure but not a launch requirement.

---

## Background

SendGrid is the chosen email provider. Patient data (email addresses, consultation content) is processed by SendGrid on servers outside Australia. A Data Processing Agreement (DPA) with SendGrid is required before launch (PRD-001).

The doctor-approved response is attributed to the reviewing doctor in all patient communications — the AI's role is never disclosed in patient-facing messages. This is a deliberate product and regulatory decision.

---

## Notification Types

| Notification | Trigger | Template |
|-------------|---------|----------|
| Registration confirmation | Account created + verified | Welcome + "book your first consultation" CTA |
| Consultation confirmation | Payment confirmed | Receipt + what happens next |
| Response ready | Doctor approves/amends consultation | Doctor's response in full |
| Rejection / refund | Doctor rejects consultation | Explanation + next steps + refund ETA |
| Follow-up check-in | 24–48 hours after response sent | How are you feeling? (PRD-015) |
| Emergency escalation | 000 instruction issued during interview | Summary of what happened + advice to seek emergency care |

---

## Functional Requirements

### Email Delivery

| # | Requirement |
|---|-------------|
| F-001 | All transactional emails sent via SendGrid API |
| F-002 | SendGrid delivery status (delivered, bounced, failed) tracked via webhook |
| F-003 | Delivery status stored in database and visible in audit log |
| F-004 | Failed delivery retried automatically by SendGrid (up to 3 attempts over 24 hours) |
| F-005 | Persistent delivery failure (bounced email) logged and flagged in admin dashboard |
| F-006 | All emails sent from a domain with SPF, DKIM, and DMARC configured |

### Response Delivery Email

| # | Requirement |
|---|-------------|
| F-007 | Response email contains: doctor's full response text (approved or amended), doctor name, date |
| F-008 | Email subject line: "Your consultation response from Dr [Name]" |
| F-009 | Email does not mention AI, Claude, or Nightingale's AI engine — response is attributed to the doctor only |
| F-010 | Email includes a "Red flags to watch" section if any red flags were noted in the SOAP note |
| F-011 | Email includes: "If your condition worsens, please seek urgent medical care or call 000." |
| F-012 | Email footer contains: Privacy Policy link, unsubscribe link, Nightingale contact details |
| F-013 | HTML email with plain text fallback |

### Rejection Email

| # | Requirement |
|---|-------------|
| F-014 | Rejection email sent immediately after doctor rejects |
| F-015 | Email explains: doctor was unable to complete a remote assessment for this consultation |
| F-016 | Email includes doctor's custom message if provided; otherwise uses default text |
| F-017 | Email confirms refund has been initiated and expected timeframe (3–5 business days) |
| F-018 | Email recommends in-person GP visit; if Medical Director's clinic is available, it may be mentioned |

### Consultation Confirmation Email

| # | Requirement |
|---|-------------|
| F-019 | Sent immediately after payment is confirmed |
| F-020 | Includes: consultation reference number, what happens next (AI interview, then doctor review), expected response timeframe |
| F-021 | No clinical content included |

### Anonymous Patient Notifications

| # | Requirement |
|---|-------------|
| F-022 | Anonymous patients receive all notifications at their registered email address |
| F-023 | Notification content does not include patient name (uses "Hi there" or similar) |

---

## Non-Functional Requirements

- **Deliverability:** Target > 98% delivery rate on non-bounced addresses
- **PII in transit:** SendGrid DPA must be signed; email content includes health information and is therefore sensitive information under the Privacy Act
- **Timing:** Response delivery email sent within 60 seconds of doctor approval

---

## Acceptance Criteria

- [ ] End-to-end test: doctor approves consultation → patient receives response email within 60 seconds
- [ ] Response email contains doctor name, full response text, red flags section, and emergency advice footer
- [ ] Response email does not contain any mention of AI
- [ ] Rejection email contains refund confirmation and in-person GP recommendation
- [ ] SendGrid delivery status (delivered/bounced) written to audit log
- [ ] Anonymous patient receives notification without name (uses generic greeting)
- [ ] All emails pass SPF/DKIM/DMARC checks (verified with mail-tester.com or equivalent)

---

## Dependencies

- PRD-001: SendGrid DPA signed before any health information sent via SendGrid
- PRD-005: Audit log captures notification events and delivery status
- PRD-013: Doctor approval/rejection triggers notification
- PRD-015: Response delivery triggers the follow-up email schedule

---

## Out of Scope

- SMS notifications (Twilio infrastructure may be set up but not enabled at MVP launch)
- Push notifications (no native app at MVP)
- In-app notification centre
- Patient email preference management (unsubscribe only, no granular preferences at MVP)
