# BUG-006 — Staging Deployment Failures: Voice & Text Consultation Broken End-to-End

**Type:** Bug — infrastructure / deployment / API  
**Priority:** P0 — consultation flow completely non-functional on staging  
**Status:** Shipped 2026-04-25 ✅  
**Affects:** All consultation types (voice and text)

---

## Summary

Voice and text consultations were completely non-functional on `nightingale-gray.vercel.app`. Five separate root causes were identified and fixed during a single debugging session. The failures cascaded — each fix exposed the next underlying issue.

---

## Issue 1 — Vercel Proxy Pointing to `localhost` (DNS_HOSTNAME_RESOLVED_PRIVATE)

### Symptom
```
POST https://nightingale-gray.vercel.app/api/v1/consultations
Status: 404 Not Found
x-vercel-error: DNS_HOSTNAME_RESOLVED_PRIVATE
```

### Root Cause
`web/next.config.ts` rewrites `/api/v1/*` to `${NEXT_PUBLIC_API_URL}/api/v1/*`, defaulting to `http://localhost:8080` when the env var is unset. Vercel's edge network blocks proxying to private/loopback addresses.

### Fix
Set `NEXT_PUBLIC_API_URL=http://nightingale-staging-794185275.ap-southeast-2.elb.amazonaws.com` in Vercel project environment variables and triggered a redeploy. No code change required.

---

## Issue 2 — Docker Build Context Pointed to Repo Root (ECR Empty, ECS Crash-Looping)

### Symptom
```
ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```
ECS service: `CannotPullContainerError — nightingale/api:staging-latest: not found`

### Root Cause
`.github/workflows/deploy-staging.yml` ran `docker build ... .` from the repo root, but the `Dockerfile` lives in `api/`. Every staging deploy since the repo was created had silently failed, leaving ECR empty and the ECS service unable to start any task.

### Fix
**`.github/workflows/deploy-staging.yml`**
```yaml
# Before:
docker build -t $IMAGE_URI:staging-latest -t $IMAGE_URI:staging-${{ github.sha }} .
# After:
docker build -t $IMAGE_URI:staging-latest -t $IMAGE_URI:staging-${{ github.sha }} ./api
```

---

## Issue 3 — ECS Service Pinned to Stale Task Definition Revision

### Symptom
ECS tasks starting on revision `:1` (created by Terraform with only `PORT` and `APP_ENV`) rather than the current revision `:3` (which includes `DB_HOST`, `DB_USER`, `DB_NAME`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`). Container exited with:
```
Error: Missing required env var: DB_HOST
```

### Root Cause
The ECS service was never updated to use the current task definition after Terraform re-registered it with the full env var set. The GitHub Actions deploy step `update-service --force-new-deployment` re-uses the service's current task definition ARN, so it kept launching with `:1`.

### Fix
Manually updated the service to the latest revision via AWS CLI:
```bash
aws ecs update-service --cluster nightingale-staging \
  --service nightingale-staging-api \
  --task-definition nightingale-staging-api:3 \
  --force-new-deployment --region ap-southeast-2
```
The deploy workflow's `--force-new-deployment` will keep the service on the latest revision going forward once a successful deploy sets it correctly.

---

## Issue 4 — RDS SSL Certificate Rejected (`SELF_SIGNED_CERT_IN_CHAIN`)

### Symptom
```json
{
  "errorCode": "SELF_SIGNED_CERT_IN_CHAIN",
  "httpStatus": 500,
  "err": { "message": "self-signed certificate in certificate chain" }
}
```
Every database-touching request returned HTTP 500.

### Root Cause
`api/src/db.ts` configured the pg pool with `ssl: { rejectUnauthorized: true }` for all non-development environments. Node.js's default CA bundle does not include the AWS RDS CA, so the TLS handshake was rejected for every connection.

### Fix
**`api/src/db.ts`**
```typescript
// Before:
ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
// After:
ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
```
Encryption is preserved; certificate chain verification is disabled. Acceptable for staging. Production should supply the AWS RDS CA bundle via `ssl: { ca: rdsCA }` before go-live.

---

## Issue 5 — Rate Limiting Broken Behind ALB (`trust proxy` Not Set)

### Symptom
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false.
  code: 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'
```
Rate limiter keyed on the ALB's internal IP rather than the client IP — all users shared a single rate limit bucket.

### Root Cause
Express defaults `trust proxy` to `false`. The ALB injects `X-Forwarded-For` on every request, so `express-rate-limit` detected the mismatch and warned. In practice, rate limiting was useless: hitting the limit for one user would rate-limit all users simultaneously.

### Fix
**`api/src/app.ts`**
```typescript
// Added before middleware stack:
app.set("trust proxy", 1);
```
Express now reads the client IP from the first `X-Forwarded-For` value (the ALB strips any client-supplied values), restoring per-client rate limiting.

---

## Issue 6 — `CLIENT.FETCH.5XX` Error Code Rejected by Regex

### Symptom
```
POST /api/v1/client-error → 400 Bad Request
{ "error": "errorCode is required and must match ^[A-Z_][A-Z_.]*$" }
```

### Root Cause
The `errorCode` validation regex in `api/src/routes/clientError.ts` was `/^[A-Z_][A-Z_.]*$/` — digits not permitted. The frontend sends `"CLIENT.FETCH.5XX"` when a 5xx response is received, which contains the digit `5`.

### Fix
**`api/src/routes/clientError.ts`**
```typescript
// Before:
const ERROR_CODE_RE = /^[A-Z_][A-Z_.]*$/;
// After:
const ERROR_CODE_RE = /^[A-Z_][A-Z_.0-9]*$/;
```

---

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/deploy-staging.yml` | Build Docker image from `./api` not `.` |
| `api/src/db.ts` | `rejectUnauthorized: false` for RDS SSL |
| `api/src/app.ts` | `app.set("trust proxy", 1)` |
| `api/src/routes/clientError.ts` | Error code regex allows digits |

---

## Acceptance Criteria — All Met ✅

- [x] `POST /api/v1/consultations` returns 2xx on staging
- [x] Voice and text consultation flows reachable end-to-end
- [x] ECS task running on task definition `:3` with full env var set
- [x] No `SELF_SIGNED_CERT_IN_CHAIN` errors in CloudWatch logs
- [x] Rate limiter using per-client IP (no `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warnings)
- [x] `POST /api/v1/client-error` with `CLIENT.FETCH.5XX` returns 204

---

## Follow-Up (Not Blocking)

- **RDS CA bundle** — for production, supply the AWS RDS CA certificate via `ssl: { ca: ... }` rather than `rejectUnauthorized: false`. This should be addressed before real patient data is handled.
- **Task definition pinning** — the deploy workflow should explicitly pass `--task-definition nightingale-staging-api:LATEST` to avoid future drift between Terraform-registered revisions and what the service is running.
