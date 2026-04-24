# BUG-004 — API Client Constructs Absolute localhost URLs, Bypassing Vercel Proxy

**Type:** Bug — environment / configuration  
**Priority:** P0 — all API calls fail on any deployed environment; consultations cannot be started or loaded  
**Sprint:** Next available  
**Scope:** Frontend only (`web/src/lib/api.ts`)

---

## Problem Summary

Every API call in the browser fails with `ERR_CONNECTION_REFUSED` because `api.ts` constructs absolute URLs using `NEXT_PUBLIC_API_URL`, which defaults to `http://localhost:8080` when the env var is not set.

```
GET  localhost:8080/api/v1/consultations    → ERR_CONNECTION_REFUSED  (dashboard load)
POST http://localhost:8080/api/v1/consultations → ERR_CONNECTION_REFUSED  (voice consultation start)
POST http://localhost:8080/api/v1/consultations → ERR_CONNECTION_REFUSED  (text consultation start)
```

The Next.js proxy rewrite in `next.config.ts` already handles this correctly — it rewrites `/api/v1/*` server-side to the real API origin. But `api.ts` bypasses the proxy by prepending an absolute origin, so the browser tries to connect to `localhost:8080` directly.

**Root cause — `web/src/lib/api.ts` line 3:**

```typescript
const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
```

`NEXT_PUBLIC_API_URL` is a build-time env var exposed to the browser. On Vercel, if this var is not set (or set to the backend ALB address), the browser builds an absolute URL that either points to an unreachable host (`localhost:8080`) or directly to the HTTP ALB — bypassing the HTTPS Vercel proxy and triggering mixed-content blocks.

The `NEXT_PUBLIC_API_URL` var is correctly consumed in `next.config.ts` as the **proxy destination** (server-side only). It should not be used in `api.ts` at all.

---

## Fix

### F-001 — Use relative paths in `api.ts`

Remove the `apiUrl()` helper and change all fetch calls to use relative paths. The Next.js rewrite proxy (`/api/v1/:path*` → backend) will route them correctly in every environment without any env var.

**`web/src/lib/api.ts` — diff:**

```typescript
// Remove:
const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// In apiFetch, change:
const res = await fetch(`${apiUrl()}${path}`, { ... });
// To:
const res = await fetch(path, { ... });

// In uploadConsultationPhoto, change:
const res = await fetch(`${apiUrl()}/api/v1/consultations/${consultationId}/photos`, { ... });
// To:
const res = await fetch(`/api/v1/consultations/${consultationId}/photos`, { ... });
```

After this change, all fetch calls emit relative paths like `/api/v1/consultations`, which Next.js rewrites server-side to the real API. The browser never makes a direct connection to the backend.

### F-002 — Remove `NEXT_PUBLIC_API_URL` from browser exposure

`next.config.ts` already reads `process.env.NEXT_PUBLIC_API_URL` at build time for the proxy destination — this is correct and should stay. But the `NEXT_PUBLIC_` prefix is only needed if the value is consumed in client-side code. Once `api.ts` is fixed, no browser code uses this var.

Consider renaming to `API_URL` (no `NEXT_PUBLIC_` prefix) to prevent accidental browser exposure of the internal ALB address. This is a server-only value.

---

## Affected Flows

| Flow | Error observed | Root cause |
|------|---------------|------------|
| Dashboard load after login | `GET localhost:8080/api/v1/consultations ERR_CONNECTION_REFUSED` | `apiUrl()` in `getConsultations()` |
| Start voice consultation | `POST localhost:8080/api/v1/consultations ERR_CONNECTION_REFUSED` | `apiUrl()` in `createConsultation()` |
| Start text consultation | `POST localhost:8080/api/v1/consultations ERR_CONNECTION_REFUSED` | `apiUrl()` in `createConsultation()` |
| All other API calls | Same failure mode | Same root cause |

---

## Out of Scope

- Adding a dev-mode fallback — `next dev` already proxies via the rewrite; the dev server handles the connection to localhost:8080 server-side, not via the browser
- Changes to `next.config.ts` proxy rules

---

## Acceptance Criteria

- [ ] `api.ts` contains no reference to `NEXT_PUBLIC_API_URL` or `localhost:8080`
- [ ] Dashboard loads consultations successfully on staging without `ERR_CONNECTION_REFUSED`
- [ ] Voice consultation start succeeds on staging
- [ ] Text consultation start succeeds on staging
- [ ] TypeScript check passes
- [ ] Existing `api.test.ts` tests pass (update any mocks that hardcode the full URL)
