# SEC-004 — Session & Token Security

> **Status:** Not Started
> **Phase:** Security Hardening — Sprint 7
> **Type:** Security — Session Management
> **Priority:** P1 — High priority; fix before scaling beyond beta
> **Owner:** CTO
> **Covers audit findings:** SEC-007 (WebSocket session token), SEC-008 (Follow-up token in audit log)

---

## Overview

Two issues affect the security of session and tracking tokens in Nightingale. The first is a structural weakness in how voice consultation streams are authenticated. The second is an unnecessary exposure of a sensitive patient token in the audit log. Neither is an immediate critical vulnerability, but both represent meaningful risk as the platform scales.

---

## Background

Nightingale uses two classes of unauthenticated-but-token-secured interactions: the voice consultation WebSocket stream (secured only by knowing the consultation ID) and the follow-up response link (secured by a UUID token in the URL). Both were designed pragmatically for the initial build. Both have token exposure pathways that become higher risk at scale, as more logs are reviewed, more exports are generated, and more people have operational access to the system.

---

## Issue 1 — WebSocket Stream Uses Consultation ID as Session Credential

### Description

The voice consultation WebSocket stream at `/api/v1/consultations/:id/stream` uses the consultation UUID as the sole session credential. The upgrade handler in `api/src/index.ts` does not validate a Bearer token — a deliberate trade-off documented in a code comment: *"the consultation ID acts as an unguessable session token; Cognito auth over WS is deferred to a follow-up PR."* This is that follow-up.

### Impact

A UUID v4 has 122 bits of entropy — it cannot be brute-forced. However, the consultation ID is not a secret by design: it appears in browser URLs (`/consultation/:id/voice`), is stored in frontend state, and is referenced throughout API requests. A patient who pastes their URL into a chat message, or a browser that leaks URLs via the Referer header to a third-party resource, exposes the ID. Anyone with the ID can connect to the live audio stream of that consultation in progress: eavesdropping on the patient's medical history disclosure in real time. Since the voice stream is the primary mode of clinical data collection, this is a high-value eavesdropping target.

### Proposed Fix

Issue a short-lived WebSocket session token immediately before the frontend opens the WebSocket connection:

1. **New API endpoint:** `POST /api/v1/consultations/:id/stream-token` — requires valid Bearer auth and patient ownership. Returns a single-use `wsToken` (UUID) with a 2-minute TTL, stored in a `ws_tokens` table (or Redis if available): `(token, consultation_id, patient_id, expires_at, used_at)`.

2. **WebSocket upgrade:** The frontend appends `?token=<wsToken>` to the WebSocket URL. The upgrade handler validates the token: checks it exists, hasn't expired, belongs to this consultation, and hasn't been used. On first valid connection, marks `used_at = NOW()` to prevent replay.

3. **Cleanup:** Expired tokens are deleted on a periodic basis (the scheduler task that runs `/followup/send` can also purge expired WS tokens).

This pattern is identical to how presigned S3 URLs work — the URL is the credential for a single operation within a short window.

---

## Issue 2 — Follow-Up Token Stored in Audit Log Metadata

### Description

When a follow-up email is dispatched, the `follow_up.sent` audit event stores the raw `followup_token` in the event metadata (`api/src/routes/followup.ts`, line 61):

```typescript
JSON.stringify({ token: row.followup_token })
```

The follow-up token is the credential that allows recording a patient's health outcome. Knowing it is equivalent to being able to respond on that patient's behalf — for example, submitting "feeling better" when the patient is actually deteriorating, suppressing a doctor re-review that should have been triggered.

### Impact

The audit log is designed to be broadly readable: compliance exports, admin log viewers, and support tooling will all access it. Any of these pathways exposes the token to whoever reads the log. A compromised admin account, a rogue support operator, or a data export that ends up in the wrong hands could allow falsification of patient health outcomes. This is a clinical safety risk, not just a privacy issue.

### Proposed Fix

Remove the token from the audit event metadata entirely. The consultation ID and the `follow_up.sent` event type are sufficient to establish the audit trail without including the token itself. If a cryptographic reference is needed (to prove the email was dispatched), store a SHA-256 hash of the token rather than the token itself:

```typescript
import { createHash } from "crypto";
const tokenHash = createHash("sha256").update(row.followup_token).digest("hex");
JSON.stringify({ token_hash: tokenHash }) // not reversible to original token
```

---

## Functional Requirements

| # | Requirement |
|---|-------------|
| F-001 | `POST /api/v1/consultations/:id/stream-token` issues a single-use WebSocket session token valid for 2 minutes |
| F-002 | Stream token endpoint requires valid Bearer auth and verifies the caller owns the consultation |
| F-003 | WebSocket upgrade validates the `?token` parameter: checks existence, expiry, consultation match, and `used_at` is null |
| F-004 | Valid WebSocket token is marked as used on first connection; a second connection attempt with the same token is rejected |
| F-005 | WebSocket connections without a valid token parameter are closed immediately with code 4001 |
| F-006 | `ws_tokens` table (or equivalent) stores: token, consultation_id, patient_id, expires_at, used_at |
| F-007 | Expired and used WS tokens are periodically cleaned up (can piggyback on existing scheduler tasks) |
| F-008 | `follow_up.sent` audit event no longer stores the raw `followup_token` in metadata |
| F-009 | Optionally, `follow_up.sent` audit event stores a SHA-256 hash of the token for reference |
| F-010 | Existing follow-up integration tests pass after metadata change |

---

## Compliance Notes

**Audit log integrity:** Removing the token from the audit log actually improves compliance posture — audit records should contain the minimum necessary data to establish the event, not sensitive operational credentials.

**Session security:** The WebSocket token pattern follows the same security model as presigned S3 URLs, which are already in use and well understood in the codebase.

---

## Acceptance Criteria

- [ ] Attempting to connect to the WebSocket stream without a valid token closes the connection with code 4001
- [ ] A stream-token is issued, used once to open a connection, and a second connection attempt with the same token is rejected
- [ ] Stream-token endpoint returns 403 for a patient attempting to get a token for another patient's consultation
- [ ] `follow_up.sent` audit log entry does not contain the raw `followup_token` in any field
- [ ] TypeScript check passes

---

## Dependencies

- PRD-004: Auth middleware (Bearer token verification)
- PRD-008: AI Voice Consultation (WebSocket stream)
- PRD-015: Post-Consultation Follow-Up (audit log metadata)

---

## Out of Scope

- WebSocket authentication for text consultation (text uses HTTP polling, not a persistent stream)
- Full Redis integration (the `ws_tokens` table in PostgreSQL is sufficient for beta scale)
- Token rotation for long-running streams (voice consultations are typically under 15 minutes; the 2-minute issue window is sufficient)
