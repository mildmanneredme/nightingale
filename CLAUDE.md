# CLAUDE.md

Working notes for Claude Code (and any other AI agents) operating in this repository. Read this before making changes.

## What this repo is

**Project Nightingale** is an AI-first, doctor-in-the-loop (HITL) telehealth platform targeting Australia. A patient consults with an AI voice/video agent, the system generates a SOAP note + differential + draft response, and a credentialed Australian doctor must approve, amend, or reject before anything reaches the patient. Patient-facing communications are attributed to the reviewing doctor — AI involvement is not disclosed.

The canonical product/business/regulatory spec is `NIGHTINGALE.md` at the repo root. Read it when a task touches scope, clinical safety, or compliance.

## Repository layout

```
nightingale/
├── NIGHTINGALE.md                          Master product/regulatory spec
├── api/                                    Backend (Node 20 + Express + TS)
├── web/                                    Frontend (Next.js 15 + React 19)
├── clinical-knowledge/                     Versioned clinical prompts & guidelines
├── stitch_nightingale_telehealth_interface/ Design system + per-flow wireframes
├── infra/                                  Terraform (AWS) + SQL migrations
├── docs/                                   PRDs, SEC, OPS, UX, BUG specs
└── .github/workflows/                      CI/CD pipelines
```

See `architecture-framework.md` for the full component map and how these pieces wire together.

## Tech stack at a glance

- **Backend:** Node 20, Express 4.19, TypeScript 5.5, `pg` against PostgreSQL 15, `ws` for WebSockets, Pino for logs, Helmet + express-rate-limit for security.
- **Frontend:** Next.js 15 App Router, React 19, Tailwind 3.4, Cognito via `amazon-cognito-identity-js`, native `fetch` wrapped in `web/src/lib/api.ts`.
- **AI:** `@anthropic-ai/sdk` and `@anthropic-ai/bedrock-sdk` for Claude (clinical engine); `@google/genai` for Gemini Live (real-time voice/video consultation).
- **AWS:** Cognito (auth), S3 + CloudFront (photos), RDS Postgres, ECS Fargate, KMS, WAF — all in `ap-southeast-2` (Sydney). Data residency is enforced.
- **Email:** SendGrid (`@sendgrid/mail` + `@sendgrid/eventwebhook` with ECDSA signature verification).
- **IaC:** Terraform 1.7+, AWS provider 5.x. Modules in `infra/terraform/modules/`, environments in `infra/terraform/envs/{staging,prod}/`.
- **Testing:** Jest + Supertest (API), Vitest + Testing Library (web), Playwright (e2e).

## Local development

### Prerequisites
- Node.js 20
- Docker (for local Postgres)
- AWS CLI + Terraform 1.7+ (only if touching infra)
- A `.env` for `api/` with Cognito user pool, Anthropic/Bedrock keys, Gemini key, S3 bucket, SendGrid key, DB URL.

### Run the API
```bash
cd api
npm install
npm run dev          # ts-node-dev on port 8080
npm run typecheck
npm test             # Jest
npm run migrate      # runs SQL migrations from infra/database/migrations
```

### Run the web app
```bash
cd web
npm install
npm run dev          # Next dev server on port 3000
npm run typecheck
npm test             # Vitest unit tests
npm run e2e          # Playwright end-to-end
```

The web app proxies `/api/v1/*` to the backend via rewrites in `web/next.config.ts`. Set `NEXT_PUBLIC_API_URL` for non-default hosts.

## Where things live

### Backend (`api/src/`)
- `index.ts` — entrypoint; HTTP + WebSocket server.
- `app.ts` — Express app, middleware order, route registration.
- `config.ts` — env-derived config (DB, Cognito, LLM keys, S3, SendGrid).
- `db.ts` — `pg.Pool` plus slow-query logging.
- `logger.ts` — Pino with correlation-ID context.
- `routes/` — 12 route modules: `patients`, `consultations`, `photos`, `doctor`, `admin`, `availability`, `renewals`, `inbox`, `followup`, `webhooks`, `health`, `clientError`.
- `services/` — 9 service modules: `clinicalAiEngine`, `rag`, `piiAnonymiser`, `redFlagDetector`, `textConsultation`, `geminiLive`, `anthropicClient`, `photoStorage`, `emailService`.
- `middleware/` — `auth` (Cognito JWT verification + role gating), `correlationId`, `errorHandler`.

### Frontend (`web/src/`)
- `app/` — Next App Router, grouped by audience: `(marketing)`, `(auth)`, `(patient)`, `(doctor)`, `(admin)`.
- `components/` — `TopAppBar`, `BottomNavBar`, `ConsultationStepper`, `StatusBadge`, `Toast(Provider)`, `ErrorState`, `DoctorSideNav`.
- `hooks/` — `useAuth`, `useToast`.
- `lib/` — `api.ts` (HTTP client), `auth.ts` (Cognito), `consultation-ws.ts` (WebSocket client), `errors.ts` (client-side error reporting to backend).

### Database (`infra/database/migrations/`)
13 numbered SQL files: audit log, patients, consultations, doctors, consultation review, RAG, photos, notifications, availability, renewals, followup, idempotency, ws_tokens. Run via `npm run migrate` from `api/`.

### Clinical knowledge (`clinical-knowledge/`)
- `system-prompts/` — base constraints, SOAP, differential, patient draft.
- `therapeutic-guidelines/` — 165+ condition directories.
- `medications/`, `mbs-items/`, `escalation/`, `regulatory/`, `red-book/`.
- Ingested into the RAG tables by a script in `api/scripts/ingest-knowledge-base.ts`. **Changes here require Medical Director approval** — don't edit clinical content without the user explicitly asking for it.

### Infrastructure (`infra/terraform/`)
- `bootstrap/` — one-time IAM/OIDC/ECR setup.
- `modules/` — `vpc`, `ecs`, `alb`, `rds`, `s3`, `ecr`, `cognito`, `cognito_presignup`, `kms`, `iam`, `cloudfront`, `waf`, `security`, `audit_export`.
- `envs/staging/`, `envs/prod/` — module composition + remote-state backend.

## Conventions and constraints

### Non-negotiable safety rules
1. **HITL gate:** No code path may deliver AI-generated content to a patient without a `doctor_id` having approved or amended the consultation. Routes that send patient-facing text must check `consultation.status IN ('approved', 'amended')`.
2. **PII anonymisation before LLM:** Every payload sent to Anthropic/Bedrock/Gemini must pass through `services/piiAnonymiser.ts`. Names, DOBs, Medicare numbers, contact details never leave AU infrastructure unredacted.
3. **Audit log is append-only.** Never `UPDATE` or `DELETE` from `audit_log`. Every doctor decision, AI output, and patient-facing communication is written here with the doctor's AHPRA number for medicolegal traceability.
4. **Data residency:** All storage in `ap-southeast-2`. Don't add resources in other regions.
5. **AHPRA advertising constraints:** Marketing copy in `(marketing)` routes is regulated. Don't change patient-facing claims without flagging it.

### Auth & RBAC
- Cognito issues JWTs with a custom `role` claim (`patient` / `doctor` / `admin`) and, for doctors, `ahpra_number`.
- Backend validates with `aws-jwt-verify`. Use `requireAuth` then `requireRole('doctor')` (etc.) on every protected route.
- Frontend stores tokens in memory only (not localStorage) — preserve this.

### Idempotency & WebSockets
- `POST /consultations` accepts an `Idempotency-Key` header; the `consultations.idempotency_key` column dedups within 24h.
- WebSocket upgrades require a single-use `ws_token` (table `ws_tokens`) — issued via REST, consumed on upgrade, marked used immediately. Don't bypass this.

### Observability
- Every request has an `X-Correlation-ID`; propagate it through downstream calls and into log lines (Pino bindings already do this in middleware).
- Slow queries (>500ms) auto-log a warning from `db.ts`.
- Client-side errors (4xx/5xx surfaced in UI) post to `/v1/client-errors` (route `clientError.ts`).

### Coding style
- TypeScript strict everywhere. Run `npm run typecheck` in both `api/` and `web/` before considering work done.
- Raw SQL via `pg` with parameterised queries. No ORM. Don't introduce one.
- No comments unless the *why* is non-obvious. Identifier names should carry the meaning.
- Prefer extending existing routes/services over adding new files. New services live in `api/src/services/`; new routes in `api/src/routes/` and must be registered in `app.ts`.

## Tests and CI

- **API unit/integration:** `cd api && npm test` — Jest + Supertest. Critical-path coverage for auth, consultation lifecycle, doctor review, photo upload, follow-up scheduling.
- **Web unit:** `cd web && npm test` — Vitest. Login, register, dashboard, new-consultation, result pages.
- **Web e2e:** `cd web && npm run e2e` — Playwright user journeys.
- **CI** (`.github/workflows/ci.yml`): runs lint + tests + Docker build on every PR; pushes a staging-tagged image to ECR on merge.
- **Deploys:** `deploy-staging.yml` and `deploy-prod.yml` are manual triggers. Prod retags a validated staging image — never builds from source directly.

Always run typecheck and the relevant test suite before claiming work is done. For UI changes, also start the dev server and verify the change in the browser; type checks and unit tests don't validate feature correctness.

## Documentation pointers

- **Product spec:** `NIGHTINGALE.md` (root).
- **Architecture map:** `architecture-framework.md` (root) — components, data flow, deployment topology, security model.
- **Per-feature PRDs:** `docs/shipped/PRD-*.md` (30 shipped, 3 backlog). Each has acceptance criteria and known constraints.
- **Operational specs:** `docs/shipped/OPS-001.md` (logging/observability), `SEC-001..005.md` (security fixes), `UX-001..004.md`, `BUG-*.md` (historical).
- **Process:** `docs/frameworks/feature-development-framework.md`.
- **Design system:** `stitch_nightingale_telehealth_interface/clinical_empathy/DESIGN.md` (Material 3, Manrope/Public Sans, navy/teal palette). Per-flow wireframes live alongside.

## Branching and commits

- Feature branches: `claude/<short-slug>-<id>` per the harness convention.
- Don't push to `main` directly. Don't open PRs unless the user asks.
- Don't `--no-verify`, `--amend` published commits, or force-push without explicit instruction.
- Never modify or weaken security middleware, audit logging, or the PII anonymiser as a shortcut to make a test pass — investigate the root cause.
