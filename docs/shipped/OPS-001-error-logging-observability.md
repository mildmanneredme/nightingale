# OPS-001 — Comprehensive Error Logging, Observability & User Error Messaging

> **Status:** Not Started
> **Phase:** Operational — Sprint 8
> **Type:** Infrastructure / Developer Tooling / UX
> **Priority:** P1 — Required before beta; bugs in production are currently invisible and users receive no actionable feedback when things go wrong
> **Owner:** CTO
> **Related audit findings:** None — new requirement driven by operational readiness

---

## Overview

Nightingale has a pino logger wired to express via `pino-http`, but coverage is shallow. There are 46 error paths that reach the global handler with no feature context — just `{ err }` and a generic message. There is no error classification, no correlation IDs propagated through the stack, no frontend error capture, no CloudWatch transport for production, and no documented process for reviewing logs.

The primary deliverable of this PRD is a logging system that is **directly reviewable by Claude Code** — structured JSON entries with sufficient context (feature, operation, user, error code, timing) that Claude can load a log extract, identify error patterns, correlate them with source code, and produce targeted bugfix PRs without requiring the human to reproduce the issue first.

---

## Background

### What exists

| Component | Current state |
|-----------|--------------|
| Logger | `pino` at `api/src/logger.ts`, level info/debug by env |
| Request logging | `pino-http` middleware on all routes |
| Error handler | Global `errorHandler.ts` — logs `{ err }`, returns 500 |
| Route-level logging | 18 logger calls across all routes; 15 are `.error()` |
| Error paths to global handler | 46 `next(err)` calls with no feature context added |
| Frontend errors | Not captured at all |
| CloudWatch transport | Not configured; production logs go to ECS task stdout only |
| Log review tooling | None |

### Gaps that create blind spots

1. **No error codes** — `"Unhandled error"` in CloudWatch tells you nothing about what failed or where
2. **No feature/operation tags** — can't filter logs by feature (consultations, renewals, inbox etc.)
3. **No user context in errors** — can't tell which patient or doctor triggered a failure
4. **No upstream failure classification** — SendGrid, Bedrock/Claude, and S3 failures look identical to DB errors
5. **No slow query detection** — DB performance degradation is invisible
6. **No frontend errors** — client-side crashes, failed fetches, and React rendering errors are completely dark
7. **No log review process** — even if logs existed, there's no workflow for Claude to audit them

---

## Functional Requirements

### F-001 — Structured error codes

Every `logger.error()` call must include a machine-readable `errorCode` string. Error codes follow the format `FEATURE.CATEGORY.SPECIFIC`:

| Code | Meaning |
|------|---------|
| `CONSULTATION.AI.UPSTREAM_FAILURE` | Claude/Bedrock call failed |
| `CONSULTATION.AI.RATE_LIMIT` | Claude/Bedrock returned 429 |
| `CONSULTATION.DB.QUERY_FAILED` | DB query threw an unexpected error |
| `CONSULTATION.PDF.GENERATION_FAILED` | pdfkit threw during PDF render |
| `EMAIL.SENDGRID.SEND_FAILED` | SendGrid API returned non-2xx |
| `EMAIL.SENDGRID.TEMPLATE_ERROR` | Email template construction failed |
| `WEBHOOK.SENDGRID.SIGNATURE_INVALID` | ECDSA signature check failed |
| `WEBHOOK.SENDGRID.UNKNOWN_MESSAGE` | sg_message_id not found in DB |
| `AUTH.JWT.VERIFY_FAILED` | JWT verification threw |
| `AUTH.JWT.EXPIRED` | JWT exp claim in the past |
| `AUTH.ROLE.INSUFFICIENT` | User lacks required Cognito group |
| `PHOTO.S3.UPLOAD_FAILED` | S3 PutObject failed |
| `PHOTO.S3.PRESIGN_FAILED` | S3 presign URL generation failed |
| `PHOTO.IDOR.REJECTED` | Photo access denied (IDOR check) |
| `RENEWAL.VALIDATION.MAX_DAYS_EXCEEDED` | validDays exceeds RENEWAL_MAX_VALID_DAYS |
| `RENEWAL.EMAIL.SEND_FAILED` | Renewal approval/decline email failed |
| `FOLLOWUP.EMAIL.SEND_FAILED` | Follow-up email dispatch failed |
| `WS.TOKEN.MISSING` | WebSocket upgrade with no token |
| `WS.TOKEN.INVALID` | WebSocket token not found or expired |
| `WS.TOKEN.REPLAYED` | WebSocket token already used |
| `DB.POOL.ERROR` | Unexpected pg pool error |
| `INTERNAL.UNHANDLED` | Error reached global handler with no specific code |

### F-002 — Canonical log entry schema

Every structured log entry must include:

```json
{
  "timestamp": "2026-04-24T12:34:56.789Z",
  "level": "error",
  "correlationId": "req-a1b2c3d4",
  "service": "nightingale-api",
  "feature": "consultations",
  "operation": "POST /api/v1/consultations/:id/chat",
  "errorCode": "CONSULTATION.AI.UPSTREAM_FAILURE",
  "errorMessage": "Claude API returned 503 Service Unavailable after 3 retries",
  "userId": "patient-uuid-or-null",
  "userRole": "patient",
  "consultationId": "uuid-or-null",
  "httpStatus": 503,
  "durationMs": 4521,
  "upstreamService": "anthropic-claude",
  "upstreamStatus": 503,
  "stack": "Error: ...\n    at ...",
  "env": "production"
}
```

**Required fields on every error entry:** `timestamp`, `level`, `correlationId`, `service`, `errorCode`, `errorMessage`

**Conditional fields (include when available):** `feature`, `operation`, `userId`, `userRole`, `consultationId`, `httpStatus`, `durationMs`, `upstreamService`, `upstreamStatus`, `stack`

### F-003 — Correlation IDs

Every incoming HTTP request gets a `correlationId` assigned at the middleware layer:
- If the request includes an `X-Correlation-ID` header, use that value (allows frontend to trace its own requests)
- Otherwise, generate a short UUID: `req-` + 8 hex characters

The `correlationId` must be:
1. Attached to the pino-http request log
2. Available as `req.correlationId` on the Express request object
3. Propagated to every `logger.error()` / `logger.warn()` call within that request's lifecycle
4. Returned in the response as `X-Correlation-ID` header (enables support to trace issues by asking the patient for the ID shown in their error screen)

### F-004 — Feature and operation tagging

Each route file creates a child logger with `feature` bound:

```typescript
const log = logger.child({ feature: "consultations" });
// All calls to log.error() automatically include feature: "consultations"
```

The `operation` field is the route method + path template (not the actual URL, to avoid logging PII in path segments):
```typescript
log.error({ errorCode, operation: "POST /api/v1/consultations/:id/chat", ... }, "message")
```

### F-005 — Error classification at global handler

The global `errorHandler.ts` must detect whether an error already has a `code` property (set by route-level code before calling `next(err)`) and use it. If not, assign `INTERNAL.UNHANDLED`. Include:
- The correlation ID from the request
- The HTTP method and route pattern
- The authenticated user ID if available

```typescript
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const errorCode = (err as any).code ?? "INTERNAL.UNHANDLED";
  logger.error({
    errorCode,
    correlationId: (req as any).correlationId,
    operation: `${req.method} ${req.route?.path ?? req.path}`,
    userId: (req as any).user?.sub ?? null,
    httpStatus: err.status ?? 500,
    err,
  }, err.message ?? "Unhandled error");
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
};
```

### F-006 — Slow query detection

The DB pool wrapper in `db.ts` must detect queries exceeding a configurable threshold (default: `SLOW_QUERY_THRESHOLD_MS=500`):

```typescript
const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? "500", 10);

// Wrap pool.query to time every DB call
const start = Date.now();
const result = await pool.query(text, params);
const durationMs = Date.now() - start;
if (durationMs > SLOW_QUERY_MS) {
  logger.warn({
    errorCode: "DB.QUERY.SLOW",
    feature: callerFeature,
    durationMs,
    query: text.substring(0, 200),  // truncate to avoid logging large params
  }, "Slow DB query");
}
```

This is implemented as a thin `query()` wrapper exported from `db.ts` — routes use `db.query()` rather than `pool.query()` directly.

### F-007 — Frontend error reporting endpoint

New API endpoint `POST /api/v1/client-error` (no auth required, rate-limited to 10/min per IP):

**Request body:**
```json
{
  "errorCode": "CLIENT.FETCH.FAILED",
  "errorMessage": "Failed to load consultation: 503",
  "page": "/consultation/abc123/result",
  "correlationId": "req-a1b2c3d4",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-04-24T12:34:56.789Z"
}
```

**Validated fields:** `errorCode` (required, must match `^[A-Z.]+$`), `errorMessage` (required, max 500 chars), `page` (optional), `correlationId` (optional). All other fields ignored.

**Server action:** Logs the entry at `warn` level with `service: "nightingale-web"`, then responds `204 No Content`. No DB write.

**Frontend integration:** A global `reportClientError()` function in `web/src/lib/errors.ts` that POSTs to this endpoint fire-and-forget. Called from:
- Unhandled fetch errors in `api.ts`'s `apiFetch()` (on 5xx responses)
- A React error boundary wrapping the entire patient layout

**Frontend error codes:**

| Code | Trigger |
|------|---------|
| `CLIENT.FETCH.5XX` | API returned 5xx |
| `CLIENT.FETCH.NETWORK` | Network failure (fetch threw) |
| `CLIENT.RENDER.BOUNDARY` | React error boundary caught a render error |
| `CLIENT.AUTH.TOKEN_EXPIRED` | API returned 401 |

### F-008 — CloudWatch Logs transport in production

In production (`NODE_ENV=production`), the pino logger uses a CloudWatch Logs transport instead of stdout.

**Implementation:** `pino-cloudwatch` or a custom pino transport using `@aws-sdk/client-cloudwatch-logs`:
- Log group: `/nightingale/api/production` (or staging)
- Log stream: one stream per ECS task instance (use task ID from ECS metadata endpoint)
- Batch writes: flush every 5 seconds or when 100 entries accumulate
- On transport failure: fall back to stdout with a warning (never lose logs silently)

**IAM requirements:** ECS task role must have `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` on the log group ARN.

**For development/staging:** pino-pretty to stdout (existing behaviour unchanged).

### F-009 — CloudWatch Logs Insights query library

A file `docs/ops/cloudwatch-queries.md` containing pre-written Insights queries for the most common review scenarios:

```
# All errors in the last 24 hours, grouped by errorCode
fields timestamp, errorCode, errorMessage, feature, userId
| filter level = "error"
| stats count(*) as count by errorCode
| sort count desc

# Errors for a specific user
fields timestamp, errorCode, operation, errorMessage
| filter level = "error" and userId = "<patient-uuid>"
| sort timestamp desc

# All errors for a specific consultation
fields timestamp, errorCode, operation, errorMessage, durationMs
| filter consultationId = "<uuid>"
| sort timestamp asc

# Frontend errors by page
fields timestamp, page, errorCode, errorMessage
| filter service = "nightingale-web"
| stats count(*) as count by page, errorCode
| sort count desc

# Slow queries in the last hour
fields timestamp, feature, durationMs, query
| filter errorCode = "DB.QUERY.SLOW"
| sort durationMs desc

# Upstream service failures (SendGrid, Claude, S3)
fields timestamp, errorCode, upstreamService, upstreamStatus, correlationId
| filter ispresent(upstreamService)
| stats count(*) as count by upstreamService, upstreamStatus
| sort count desc

# 5xx rate over time (1-hour buckets)
fields timestamp
| filter httpStatus >= 500
| stats count(*) as errors by bin(1h)
| sort timestamp asc
```

### F-010 — Log review process documentation

A runbook at `docs/ops/log-review-runbook.md` documenting how to conduct a Claude-assisted log audit:

1. **Export**: Run the "All errors last 24h by errorCode" query in CloudWatch Logs Insights → Export results as JSON
2. **Triage**: Paste the JSON into a Claude Code session with prompt: *"Review these error logs from Nightingale production. Identify the 3 most actionable error patterns, find the relevant source code, and produce a bugfix recommendation for each."*
3. **Deep-dive**: For each identified pattern, run the per-feature or per-consultation query to get full context
4. **Bugfix PRD**: Claude writes a targeted bugfix PRD (or directly implements if straightforward)
5. **Cadence**: Weekly review minimum; daily if error rate > 1% of requests

---

## User-Facing Error Display

The logging system is invisible to patients and doctors. They need a parallel, parallel-but-connected layer: dismissible toast notifications that tell them what went wrong, what to do next, and — critically — include the correlation ID so support can find the exact log entry.

### F-011 — Toast notification component

New component `web/src/components/Toast.tsx` (and `web/src/hooks/useToast.ts`):

```typescript
// Usage from any page
const { toast } = useToast();
toast.error("Could not send message", {
  detail: "Connection issue — please try again.",
  correlationId: "req-a1b2c3d4",  // injected from X-Correlation-ID response header
});
```

**Visual spec:**
- Position: bottom-right, stacked (newest on top), max 3 visible at once
- Width: 360px on desktop, full-width on mobile
- Auto-dismiss: 8 seconds for errors, 5 seconds for warnings, 3 seconds for success
- Manual dismiss: × button always visible
- Severity variants: `error` (error-container colours), `warning` (amber), `success` (tertiary-container), `info` (surface-container)
- Animation: slide in from right, fade out on dismiss

**Structure of an error toast:**
```
┌─────────────────────────────────────────┐
│ ● Could not send message            [×] │
│   Connection issue — please try again.  │
│   Reference: req-a1b2c3d4               │
└─────────────────────────────────────────┘
```

The `Reference: req-a1b2c3d4` line only appears when a `correlationId` is provided. It lets a patient tell support "I got error req-a1b2c3d4" and the developer can find the exact log entry in CloudWatch.

### F-012 — Correlation ID extraction from API responses

`apiFetch()` in `api.ts` must read the `X-Correlation-ID` response header on every call and make it available alongside any error thrown:

```typescript
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly correlationId?: string  // NEW
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// In apiFetch:
const correlationId = res.headers.get("x-correlation-id") ?? undefined;
throw new ApiError(res.status, message, correlationId);
```

### F-013 — Standard error messages by HTTP status

A lookup table in `web/src/lib/errors.ts` maps HTTP status codes to user-facing messages so every page shows consistent, non-technical copy:

| Status | User-facing title | User-facing detail |
|--------|-------------------|-------------------|
| 400 | "Something doesn't look right" | "Please check your input and try again." |
| 401 | "You've been signed out" | "Please sign in again to continue." |
| 403 | "Access denied" | "You don't have permission to do this." |
| 404 | "Not found" | "This item no longer exists or may have been removed." |
| 409 | "Already submitted" | "This action has already been completed." |
| 429 | "Too many requests" | "Please wait a moment before trying again." |
| 500 | "Something went wrong on our end" | "Our team has been notified. Please try again in a few minutes." |
| 503 | "Service temporarily unavailable" | "We're experiencing high demand. Please try again shortly." |
| Network error | "Connection problem" | "Check your internet connection and try again." |

### F-014 — Integration points: where toasts appear

Every page that makes a mutating API call (form submit, button click) must show a toast on failure. Pages that currently silently ignore errors or show nothing must be updated:

| Page / component | Current behaviour on error | Required behaviour |
|------------------|---------------------------|-------------------|
| Text chat (`/consultation/:id/text`) | Shows inline "connection issue" text in chat | Toast error + keep inline text for continuity |
| Profile save (`/profile`) | Shows inline error div | Keep inline + also show toast |
| Photo upload (`/consultation/:id/photos`) | Unknown — no explicit error UI | Toast with retry instruction |
| Doctor approve/amend/reject | No visible error state | Toast error with correlationId |
| Doctor reassign (admin portal) | `alert()` call — blocks UI | Replace with toast |
| Script renewal submit | No visible error state | Toast error |
| Script renewal approve/decline | No visible error state | Toast error |
| Inbox mark-as-read | Silently catches error (`catch(() => null)`) | Keep silent — not worth surfacing |
| Dashboard PDF download | No visible error state | Toast: "PDF not available right now" |

### F-015 — Global `ToastProvider`

`ToastProvider` wraps `RootLayout` so toasts work on every page without prop-drilling:

```typescript
// app/layout.tsx
<AuthContext.Provider value={...}>
  <ToastProvider>
    {children}
  </ToastProvider>
</AuthContext.Provider>
```

The `useToast()` hook reads from `ToastContext` and is available anywhere in the component tree.

### F-016 — React error boundary with toast

The patient layout's error boundary (introduced in F-007 for logging) must also display a toast:

```typescript
componentDidCatch(error: Error) {
  const correlationId = (error as any).correlationId;
  // Log to server
  reportClientError("CLIENT.RENDER.BOUNDARY", error.message, correlationId);
  // Show toast
  this.context.toast.error("Something went wrong", {
    detail: "Please refresh the page. If the problem continues, contact support.",
    correlationId,
  });
}
```

---

## Technical Design

### Correlation ID middleware

New file `api/src/middleware/correlationId.ts`:

```typescript
import { randomBytes } from "crypto";
import { RequestHandler } from "express";

export const correlationId: RequestHandler = (req, res, next) => {
  const id = (req.headers["x-correlation-id"] as string) ?? `req-${randomBytes(4).toString("hex")}`;
  (req as any).correlationId = id;
  res.setHeader("X-Correlation-ID", id);
  next();
};
```

Registered as the very first middleware in `app.ts` (before helmet, before rate limiter).

### Feature child loggers

Each route file adopts a child logger pattern:

```typescript
// api/src/routes/consultations.ts
import { logger } from "../logger";
const log = logger.child({ feature: "consultations" });
```

All `log.error()` calls include `{ errorCode, correlationId: req.correlationId, ... }`.

### Error enrichment before next(err)

Rather than bare `next(err)`, route handlers attach context:

```typescript
} catch (err) {
  (err as any).code = "CONSULTATION.AI.UPSTREAM_FAILURE";
  (err as any).correlationId = req.correlationId;
  next(err);
}
```

The global handler reads these to produce a rich log entry.

### DB query wrapper

```typescript
// api/src/db.ts — exported query wrapper
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[],
  context?: { feature?: string; correlationId?: string }
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, values);
    const durationMs = Date.now() - start;
    if (durationMs > SLOW_QUERY_MS) {
      logger.warn({ errorCode: "DB.QUERY.SLOW", durationMs, feature: context?.feature, correlationId: context?.correlationId, query: text.slice(0, 200) }, "Slow DB query detected");
    }
    return result;
  } catch (err) {
    logger.error({ errorCode: "DB.QUERY.FAILED", feature: context?.feature, correlationId: context?.correlationId, query: text.slice(0, 200), err }, "DB query failed");
    throw err;
  }
}
```

---

## Acceptance Criteria

**Logging (server-side)**
- [ ] Every `logger.error()` call includes `errorCode`, `correlationId`, and `feature`
- [ ] Every HTTP response includes an `X-Correlation-ID` header
- [ ] The global error handler logs `INTERNAL.UNHANDLED` with userId and operation for any error that arrives without a code
- [ ] DB queries exceeding 500ms emit a `DB.QUERY.SLOW` warn log
- [ ] `POST /api/v1/client-error` returns 204 and logs frontend errors at warn level
- [ ] In production, logs are written to CloudWatch Logs `/nightingale/api/production`
- [ ] `docs/ops/cloudwatch-queries.md` contains at least 7 Insights queries covering the scenarios in F-009
- [ ] `docs/ops/log-review-runbook.md` documents the Claude-assisted review process

**User-facing error display**
- [ ] `Toast` component renders with error/warning/success/info variants, auto-dismisses, and shows a `Reference: <correlationId>` line when a correlation ID is provided
- [ ] `useToast()` hook is available from any page via `ToastProvider` in the root layout
- [ ] `ApiError` carries the `correlationId` from the `X-Correlation-ID` response header
- [ ] `apiFetch()` calls `reportClientError()` on 5xx responses and surfaces a toast via the standard error message table
- [ ] All pages listed in F-014 show a toast (not a silent failure or a raw `alert()`) when their API call fails
- [ ] The React error boundary shows a toast with a support reference when a render error is caught
- [ ] Doctor reassign `alert()` call is replaced with a toast

**General**
- [ ] TypeScript check passes on all modified files
- [ ] All existing tests remain green

---

## Implementation Notes

### Phasing

This PRD is one coherent change — do not ship partial logging. A system with inconsistent error codes is harder to query than one with none at all. Implement all features in a single PR.

### PII in logs

Never log PII (patient name, DOB, address, Medicare number) in log entries. Log UUIDs only:
- `userId`: cognito sub UUID
- `consultationId`: UUID
- `patientId`: UUID
- Do not log email addresses, names, or health information

The `query` field in slow-query logs is truncated to 200 characters and must not include parameterised values (params are passed separately and never logged).

### Log volume

At 200 consultations/day with 10 API calls each = 2,000 requests/day. At ~500 bytes/entry for request logs, that is ~1 MB/day — well within CloudWatch free tier (5 GB/month ingestion). `DEBUG` level is suppressed in production.

### Existing logger.error calls

All 15 existing `logger.error()` calls in route files must be updated to include an `errorCode` and `correlationId`. This is not optional — an error log without a code cannot be queried systematically.

---

## Dependencies

- PRD-003: Infrastructure & DevOps (CloudWatch Logs IAM already in ECS task role — needs `logs:PutLogEvents` grant)
- SEC-003: API Hardening (rate limiting already in place — client-error endpoint rate limit follows same pattern)

---

## Out of Scope

- Distributed tracing (OpenTelemetry / X-Ray) — post-beta
- Log-based alerting / CloudWatch Alarms — separate operational PRD
- Error dashboards (Grafana, Datadog) — post-beta; Insights queries are sufficient for Claude review
- APM (Application Performance Monitoring) — post-beta
- Audit log viewer in the admin portal — separate from error logs (audit log is compliance; error log is debugging)
- Log retention policy changes (uses CloudWatch default of never-expire until explicitly set)
