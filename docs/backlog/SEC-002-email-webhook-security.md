# SEC-002 — Email & Webhook Security

> **Status:** Not Started
> **Phase:** Security Hardening — Sprint 7
> **Type:** Security — Input Validation / Integrity
> **Priority:** P0 — Must ship before any real patients are onboarded
> **Owner:** CTO
> **Covers audit findings:** SEC-004 (SendGrid webhook signature), SEC-005 (HTML injection in emails)

---

## Overview

Two vulnerabilities affect the email communication pipeline. The first allows an external attacker to forge SendGrid delivery events and corrupt notification status in the database. The second allows a doctor (or a compromised doctor account) to inject arbitrary HTML into patient-facing clinical emails. Both must be fixed before real patient data flows through the system.

---

## Background

Email is a critical pathway in Nightingale — it delivers clinical responses, rejection notices, renewal approvals, and follow-up requests. Any corruption of email delivery data or injection into email content directly impacts patient safety and trust. These are not theoretical edge cases; both attack vectors are straightforward to exploit by anyone who discovers the relevant endpoint or has doctor-level access.

---

## Issue 1 — SendGrid Webhook Has No Signature Verification

### Description

`POST /api/v1/webhooks/sendgrid` (`api/src/routes/webhooks.ts`) accepts any POST body with no validation that the request genuinely originated from SendGrid. SendGrid signs every webhook delivery with an ECDSA signature transmitted in the `X-Twilio-Email-Event-Webhook-Signature` header. The current handler ignores this header entirely.

### Impact

An attacker who discovers the webhook URL can POST fabricated delivery events to manipulate notification records in the database. For example, they could mark a bounced email as `delivered`, hiding the fact that a patient never received their clinical response. This would cause the system to report successful delivery in the audit log when the patient has received nothing, potentially masking a situation where a patient is waiting for care instructions that never arrived. In a regulatory sense, false delivery records in an immutable audit log are a compliance liability.

### Proposed Fix

Use SendGrid's official `@sendgrid/eventwebhook` package to verify the ECDSA signature on every incoming request. The public key is provided in the SendGrid dashboard and stored as `SENDGRID_WEBHOOK_PUBLIC_KEY` in environment config. Requests that fail verification must be rejected with a 403 before any database writes occur.

```typescript
import { EventWebhook } from "@sendgrid/eventwebhook";

const ev = new EventWebhook();
const key = ev.convertPublicKeyToECDH(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY!);
const isValid = ev.verifySignature(
  key,
  req.body,          // raw body (must use express.raw() for this route)
  req.headers["x-twilio-email-event-webhook-signature"] as string,
  req.headers["x-twilio-email-event-webhook-timestamp"] as string
);
if (!isValid) {
  res.status(403).json({ error: "Invalid webhook signature" });
  return;
}
```

**Note:** SendGrid signature verification requires the raw request body bytes, not the parsed JSON. The webhook route must use `express.raw({ type: "application/json" })` instead of `express.json()`. This is a targeted override — other routes continue to use `express.json()`.

---

## Issue 2 — HTML Injection in Doctor Rejection Emails

### Description

The `buildRejectionHtml()` function in `api/src/services/emailService.ts` (line 315) interpolates the doctor's `customMessage` directly into an HTML `<p>` tag with no escaping:

```typescript
const customPara = opts.customMessage ? `<p>${opts.customMessage}</p>` : "";
```

A doctor who writes `<a href="https://malicious.site">Click here for your results</a>` as a rejection message would have that anchor rendered in the patient's email client. More seriously, certain email clients render `<script>` tags or `<img onerror>` handlers, enabling stored cross-site scripting.

### Impact

Patients who receive a rejection email are in a vulnerable state — they've been told a remote assessment wasn't possible and are being directed toward in-person care. Injected content in this email could redirect them to a phishing site, deliver malware, or simply undermine trust in the platform. While a doctor is a trusted actor in the system, compromised doctor credentials (or a malicious insider) would make this a realistic attack vector.

### Proposed Fix

HTML-escape all user-supplied content before interpolation using the `he` library (`he.escape()`), which handles the full set of HTML special characters including quotes, angle brackets, and ampersands. This must be applied to:

1. `customMessage` in `buildRejectionHtml()` and `buildRejectionPlain()`
2. `reviewNote` in `sendRenewalApprovedEmail()` and `sendRenewalDeclinedEmail()`
3. Any other field sourced from user input that is interpolated into HTML email templates

Plain-text email bodies do not require HTML escaping but must not contain unintended HTML tags.

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | All incoming SendGrid webhook requests are verified against the ECDSA signature in `X-Twilio-Email-Event-Webhook-Signature` |
| F-002 | Requests failing signature verification return 403 and no database writes are performed |
| F-003 | If `SENDGRID_WEBHOOK_PUBLIC_KEY` is not set, webhook requests are rejected with a 500 and a log warning (fail-closed, not fail-open) |
| F-004 | Webhook route uses raw body parsing; all other routes continue to use JSON body parsing |
| F-005 | Doctor rejection `customMessage` is HTML-escaped before interpolation in all email templates |
| F-006 | Renewal `reviewNote` is HTML-escaped before interpolation in approval and decline email templates |
| F-007 | A unit test confirms that a `customMessage` containing `<script>alert(1)</script>` produces `&lt;script&gt;alert(1)&lt;/script&gt;` in the rendered HTML |
| F-008 | Existing webhook integration tests are updated to include a valid signature header |

---

## Compliance Notes

**Audit trail integrity:** The webhook signature verification protects the immutability guarantee of the audit log. Without it, delivery events written to `audit_log` via the webhook handler cannot be trusted as authentic.

**AHPRA-safe content:** HTML escaping ensures that doctor-authored content is rendered as intended text in patient emails and cannot be used to circumvent the compliance review of patient-facing copy.

---

## Acceptance Criteria

- [ ] Webhook POST without a valid signature header returns 403
- [ ] Webhook Post with valid signature processes events and updates notification records correctly
- [ ] Rejection email containing HTML special characters in `customMessage` renders them as escaped text, not HTML
- [ ] `he` library added to `api/package.json` dependencies
- [ ] `SENDGRID_WEBHOOK_PUBLIC_KEY` added to config.ts with `required()` in production and `optional()` with empty default in development
- [ ] TypeScript check passes

---

## Dependencies

- PRD-014: Patient Notifications (webhook handler being patched)
- PRD-013: Doctor Review Dashboard (rejection message source)

---

## Out of Scope

- Escaping AI-generated content (AI drafts are not user-supplied; they go through doctor review before patient delivery)
- Webhook retry handling (SendGrid retries automatically; idempotency is already handled by `sg_message_id` deduplication)
