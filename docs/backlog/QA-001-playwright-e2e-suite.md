# QA-001 — Playwright End-to-End Test Suite

> **Status:** Not Started
> **Phase:** Periodic / on-request (not part of per-PR CI)
> **Type:** Quality Assurance — Test Infrastructure
> **Owner:** CTO

---

## Overview

Build a Playwright-based browser test suite that exercises every critical user journey on Nightingale end-to-end against a real running stack (web + api + Postgres + mocked third parties). The suite is designed to be run **periodically and on request** — for example, before a release, after large refactors, or overnight as a regression check — not on every PR.

This complements the existing per-PR test suites (Jest for API, Vitest for web units), which remain the fast feedback loop on every change.

---

## Why This Is Separate From Per-PR CI

- E2E runs are slower (~3–5 min total once cold-start, browser install, and stack boot are included) and add infrastructure flakiness that is disproportionate to the per-PR change rate.
- Voice consultation cannot be fully tested in CI without a paid Gemini Live API key and real audio I/O; we mock the WebSocket layer instead, which is enough to catch regressions in the UI flow but not in the AI behaviour itself.
- Several journeys depend on Cognito users that exist in the staging User Pool — keeping that surface separate from per-PR CI avoids leaking test credentials into PR runs from forks.

---

## Goals

1. Cover every primary user journey on the patient, doctor, and admin sides.
2. Run the entire suite in under 10 minutes on a developer machine with the dev stack already running.
3. Be deterministic enough to run unattended (e.g., overnight) — no flaky tests left in the suite; quarantine any that flake more than once.
4. Produce a single HTML report (`playwright-report/`) that shows failures, screenshots, and traces for each failed step.

---

## Non-Goals

- Real Gemini Live voice AI integration testing (handled by a separate manual test plan).
- Load / performance testing (out of scope; would use k6 / Artillery if added).
- Accessibility testing (separate effort; could be added later via `@axe-core/playwright`).
- Replacing the existing Jest / Vitest unit suites — those stay the per-PR gate.

---

## Coverage Matrix

### Patient Journeys

| # | Journey | Notes |
|---|---------|-------|
| P-01 | Sign up → email verification → first login | Cognito test pool; email codes via SES sandbox or fixed-value bypass in test env |
| P-02 | Forgot password → reset → re-login | |
| P-03 | Complete profile (full address, IHI optional, paediatric/guardian fields) | |
| P-04 | Start a new **text** consultation → exchange messages → receive AI completion → see status update | Gemini Flash chat mocked at HTTP boundary |
| P-05 | Start a new **voice** consultation → audio-check → WebSocket handshake → end consultation → transcript saved | WS server mocked — verify only the UI flow + protocol, not AI response quality |
| P-06 | Upload a clinical photo on a text consultation → quality checks pass → photo stored | S3 mocked locally |
| P-07 | View dashboard with multiple consultations in different states (in_progress, awaiting_review, response_ready, rejected, amended) | Seed data fixture |
| P-08 | Open inbox → click "View Your Assessment" / "Download PDF Summary" | |
| P-09 | View history detail page; verify all 11 status branches render correctly | |
| P-10 | Submit a script renewal → see it in pending list | |

### Doctor Journeys

| # | Journey | Notes |
|---|---------|-------|
| D-01 | Doctor login (MFA enforced) → land on `/doctor/queue` | Cognito test user with `doctor` group |
| D-02 | Open a queued consultation → review SOAP → **approve** → patient inbox updated | |
| D-03 | Open a queued consultation → **amend** in side-by-side editor → save → patient sees amended draft | |
| D-04 | Open a queued consultation → **reject** with reason → patient sees rejection + refund notice | |
| D-05 | Open the renewals queue → approve and decline a renewal | |
| D-06 | Update weekly availability schedule + add a date override | |

### Admin Journeys

| # | Journey | Notes |
|---|---------|-------|
| A-01 | Admin login → `/admin/beta` shows stats | |
| A-02 | `/admin/consultations`: see 4h-overdue alert; reassign a consultation to another doctor | |

### Marketing & Cross-Cutting

| # | Journey | Notes |
|---|---------|-------|
| M-01 | All 10 marketing pages render at 375px and 1280px without layout breakage | Visual snapshot per page |
| M-02 | Privacy / Terms / Disclaimer pages reachable from footer | |
| X-01 | Auth-guarded routes redirect unauthenticated users to login | |
| X-02 | Role-mismatch redirects (patient hitting `/doctor/*`, etc.) | |
| X-03 | `not-found.tsx` renders on unknown routes | |

---

## Test Environment & Stack

- **Web**: Next.js dev server on `http://localhost:3000`, started by Playwright `webServer` config.
- **API**: Express dev server on `http://localhost:4000`, started in parallel.
- **Postgres**: ephemeral database via `docker compose up -d postgres-test` against a dedicated `nightingale_test` DB; migrations run before each suite.
- **Cognito**: real staging User Pool with a fixed set of `qa-patient-*@nightingale.test`, `qa-doctor-*@nightingale.test`, `qa-admin-*@nightingale.test` users. Passwords stored in 1Password / env vars, not in the repo.
- **Third parties (mocked at HTTP/WS boundary inside the api process when `NODE_ENV=test-e2e`)**:
  - Anthropic Bedrock (clinical AI engine) — fixed JSON SOAP responses.
  - Gemini Live API — replayable WebSocket recording.
  - Gemini Flash chat — fixed JSON.
  - SendGrid mail + webhook — capture into in-memory store; assert sent count and content.
  - S3 — `localstack` or `aws-sdk-client-mock`.
  - Stripe — out of scope for now (PRD-007 deferred).

---

## Implementation Plan

### Phase 1 — Skeleton (1 session)
1. Add `web/playwright.config.ts` with `webServer` entries for both web and api dev servers.
2. Add `web/e2e/` folder with a single smoke test (`/` loads, marketing nav works).
3. Add an npm script `test:e2e` at the repo root (or a `package.json` workspace script) that boots Postgres-test, runs migrations, runs Playwright, tears down.
4. Document the local invocation in `web/README.md`.

### Phase 2 — Core patient journeys (1–2 sessions)
- P-01, P-02, P-04, P-07, P-08, P-09 — these unblock most regressions.
- Build a `fixtures/` folder for seed data (consultations across all 11 statuses, sample patient profile).

### Phase 3 — Voice + photo + renewals (1 session)
- P-05 with WS mock.
- P-06 with S3 mock.
- P-10.

### Phase 4 — Doctor & admin journeys (1 session)
- D-01–D-06, A-01, A-02.

### Phase 5 — Cross-cutting + marketing visual snapshots (1 session)
- M-01, M-02, X-01–X-03.
- Integrate Playwright HTML report archive into the overnight runner.

Each phase commits separately and is independently runnable.

---

## Running the Suite

```bash
# One-time
cd web && npx playwright install --with-deps

# Run everything (boots stack, runs migrations, tears down)
npm run test:e2e

# Run a single journey while iterating
cd web && npx playwright test e2e/patient/new-text-consultation.spec.ts --headed

# Debug
cd web && npx playwright test --ui

# Open the last report
cd web && npx playwright show-report
```

For overnight runs: a wrapper script (`scripts/overnight-e2e.sh`) seeds a fresh DB, runs the suite with `--retries=2`, and uploads the HTML report + traces to a local timestamped folder under `qa-runs/`.

---

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 — skeleton | 0.5 day | Includes config, smoke test, scripts |
| Phase 2 — core patient | 1.0 day | 6 journeys + fixtures |
| Phase 3 — voice / photo / renewals | 1.0 day | WS + S3 mocking is the time sink |
| Phase 4 — doctor / admin | 0.5 day | Smaller journey count |
| Phase 5 — cross-cutting + visual | 0.5 day | |
| **Total** | **~3.5 days** | Spread across multiple sessions |

---

## Success Criteria

- All journeys in the coverage matrix have at least one passing spec.
- A full overnight run produces zero flakes across 5 consecutive runs.
- An intentionally-broken refactor (e.g., remove a route) is caught by at least one spec.
- HTML report + trace viewer accessible for every failure.

---

## Open Questions

1. Cognito test users — are we comfortable using the staging pool, or do we need a dedicated `nightingale-test` pool?
2. Where should the Playwright report archive live? Local `qa-runs/` folder, or upload to S3 for shareability?
3. Do we want visual regression snapshots (Playwright supports this natively via `toHaveScreenshot()`), or skip until after the design is more stable?
