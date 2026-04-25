# Architecture Framework — Project Nightingale

A component-by-component map of the platform and how the pieces fit together. Companion to `NIGHTINGALE.md` (product/regulatory spec) and `CLAUDE.md` (developer onboarding).

## 1. System overview

Nightingale is an AI-first, doctor-in-the-loop telehealth platform. A patient consults with an AI agent over voice/video; the system produces a clinical summary, differential diagnosis, and draft response; an Australian-registered doctor approves, amends, or rejects before anything reaches the patient.

```
                   ┌─────────────────────────────────────────────────────┐
                   │                  Patient (browser)                  │
                   └──────────────┬───────────────────────┬──────────────┘
                                  │ HTTPS                 │ WebSocket
                                  ▼                       ▼
        ┌───────────────────────────────────────────────────────────────┐
        │           Web frontend (Next.js 15 on Vercel)                 │
        │   marketing · auth · patient · doctor · admin route groups    │
        └──────────────┬───────────────────────────────────┬────────────┘
                       │ /api/v1/* rewrite                 │ wss://
                       ▼                                   ▼
        ┌───────────────────────────────────────────────────────────────┐
        │      Backend API (Express + ws) on AWS ECS Fargate            │
        │      routes → middleware (auth/correlation) → services        │
        └─┬──────┬──────┬──────────┬─────────────┬─────────────┬────────┘
          │      │      │          │             │             │
          ▼      ▼      ▼          ▼             ▼             ▼
       Cognito  RDS    S3+CF    Gemini Live   Anthropic     SendGrid
       (JWT)  Postgres (photos) (voice/video) (Claude /     (email +
                                              Bedrock)      webhooks)

         All AWS resources pinned to ap-southeast-2 (Sydney).
         Clinical knowledge and system prompts are versioned in Git
         and ingested into RDS (RAG tables) on deploy.
```

## 2. Components

### 2.1 Web frontend — `web/`

Next.js 15 App Router, React 19, Tailwind 3.4, TypeScript 5.

**Route groups** (under `web/src/app/`):
- `(marketing)/` — public, SEO-focused: home, FAQ, about, how-it-works, pricing, for-doctors, privacy, terms, disclaimer, safety.
- `(auth)/` — login, register, forgot-password.
- `(patient)/` — `/dashboard`, `/consultation/new`, `/consultation/[id]/{audio-check,voice,text,result}`, `/history`, `/inbox`, `/profile`, `/renewals`.
- `(doctor)/` — `/doctor/queue`, `/doctor/consultation/[id]`, `/doctor/consultation/[id]/{amend,reject}`, `/doctor/renewals`, `/doctor/schedule`.
- `(admin)/` — user management, audit log viewer (in progress).
- `/followup/confirmed` — unauthenticated landing for follow-up email links.

**Shared modules:**
- `lib/api.ts` — fetch wrapper; injects `Authorization: Bearer <token>` and forwards `X-Correlation-ID`.
- `lib/auth.ts` — Cognito sign-in/up/confirm/reset via `amazon-cognito-identity-js`.
- `lib/consultation-ws.ts` — WebSocket client for live consultation streaming.
- `lib/errors.ts` — surfaces 4xx/5xx errors and reports them to the backend `/v1/client-errors`.
- `hooks/useAuth.ts`, `hooks/useToast.ts` — context-backed.
- `components/` — `TopAppBar`, `BottomNavBar`, `ConsultationStepper`, `StatusBadge`, `Toast(Provider)`, `ErrorState`, `DoctorSideNav`.

**Build/deploy:** Vercel for the web tier; `next.config.ts` rewrites `/api/v1/*` to the ALB in front of the API.

**Testing:** Vitest + Testing Library for components; Playwright for journeys.

---

### 2.2 Backend API — `api/`

Node 20, Express 4.19, TypeScript 5.5. Single deployable; HTTP and WebSocket served from the same process.

**Entrypoints:**
- `src/index.ts` — boots HTTP server, attaches `ws` upgrade handler, validates single-use `ws_token`s.
- `src/app.ts` — Express app: Helmet, rate-limit (300/min), correlation-ID middleware, route registration, global error handler.
- `src/config.ts` — environment configuration (DB, Cognito pool, Anthropic/Bedrock, Gemini, S3 bucket+KMS, SendGrid).
- `src/db.ts` — `pg.Pool` with slow-query logging (>500 ms warns).
- `src/logger.ts` — Pino with correlation-ID bindings.

**Route modules** (`src/routes/`, 12 files):

| Route | Responsibilities |
|---|---|
| `patients.ts` | Registration, profile (allergies, medications, conditions, guardian for paediatric). |
| `consultations.ts` | Create (idempotent), fetch, status transitions, ws_token issuance. |
| `photos.ts` | Multipart upload via `multer` → S3, presigned reads, KMS-encrypted at rest. |
| `doctor.ts` | Queue, approve, amend, reject; writes to `audit_log`. |
| `admin.ts` | User management, audit-log queries, system config. |
| `availability.ts` | Doctor schedule slots, response-time estimates. |
| `renewals.ts` | Script renewal requests, doctor queue, expiry tracking. |
| `inbox.ts` | Patient-side message history and delivery status. |
| `followup.ts` | 24–48h post-consultation check-in trigger and patient response capture. |
| `webhooks.ts` | SendGrid delivery-event webhook with ECDSA signature verification. |
| `health.ts` | `/health` (Cognito), `/ready` (DB) for ALB. |
| `clientError.ts` | Receives client-side error reports for centralised logging. |

**Middleware** (`src/middleware/`):
- `auth.ts` — `requireAuth` (Cognito JWT via `aws-jwt-verify`); `requireRole('patient'|'doctor'|'admin')`.
- `correlationId.ts` — generates/propagates `X-Correlation-ID` (OPS-001).
- `errorHandler.ts` — translates errors to JSON; logs structured context.

**Services** (`src/services/`, 9 files):

| Service | What it does |
|---|---|
| `clinicalAiEngine.ts` | Orchestrates the post-consultation pipeline: PII anonymise → RAG retrieve → SOAP + differential + draft response via Claude → red-flag/cannot-assess flagging → write outputs + audit. |
| `rag.ts` | Keyword-based retrieval over `rag_chunks` populated from `clinical-knowledge/`. |
| `piiAnonymiser.ts` | Strips names, DOBs, Medicare/contact data before any LLM call (APP 8 compliance). |
| `redFlagDetector.ts` | Real-time pattern matcher on transcript: chest pain + dyspnoea, thunderclap headache, stroke, anaphylaxis, suicidal ideation. Triggers 000 instruction immediately. |
| `textConsultation.ts` | Text-chat fallback when audio quality is poor. |
| `geminiLive.ts` | Google Gemini Live API integration for real-time voice/video. |
| `anthropicClient.ts` | Claude SDK wrapper supporting direct Anthropic API and AWS Bedrock. |
| `photoStorage.ts` | S3 PUT/GET with `sharp` resize, KMS-managed SSE, presigned URLs. |
| `emailService.ts` | SendGrid send + delivery-status reconciliation; PDF letter attachments via `pdfkit`. |

**Build/run:** `tsc` → `dist/`. Multi-stage Dockerfile in `api/Dockerfile`. Migrations via `npm run migrate` reading SQL from `infra/database/migrations/`.

---

### 2.3 Database — PostgreSQL 15 (RDS)

13 numbered SQL migrations in `infra/database/migrations/`:

| # | File | Adds |
|---|---|---|
| 001 | `audit_log.sql` | Immutable append-only audit log (event_type, actor, AHPRA, consultation_id, metadata, ts). |
| 002 | `patients.sql` | Patient PII, allergies, medications, conditions. |
| 003 | `consultations.sql` | Status enum, transcript, links to patient/doctor. |
| 004 | `doctors.sql` | AHPRA number, full name, availability summary. |
| 005 | `consultation_review.sql` | `assigned_doctor_id`, SOAP, differentials, draft response, flags. |
| 006 | `rag.sql` | `rag_chunks`, `snomed_terms`. |
| 007 | `consultation_photos.sql` | Encrypted S3 keys + metadata. |
| 008 | `notifications.sql` | Email/SMS queue + delivery state. |
| 009 | `doctor_availability.sql` | Time slots + response-time estimate. |
| 010 | `renewals.sql` | Script renewals, expiry, doctor queue. |
| 011 | `followup.sql` | Post-consultation triggers + patient responses. |
| 012 | `consultation_idempotency.sql` | 24h dedup on consultation creation. |
| 013 | `ws_tokens.sql` | Single-use WebSocket upgrade tokens. |

Connections occur over private subnets only; multi-AZ; encryption-at-rest via KMS; 7-day automated backups.

---

### 2.4 Clinical knowledge — `clinical-knowledge/`

Markdown content under Medical Director governance, ingested into the RAG tables on deploy.

- `system-prompts/` — `base-constraints.md`, `soap-note.md`, `differential-diagnosis.md`, `patient-draft-response.md`. These define safety rules, escalation triggers, confidence thresholds, and output templates used by `clinicalAiEngine.ts`.
- `therapeutic-guidelines/` — 165+ condition directories (acne through urinary-tract-infection); each carries assessment criteria, management, patient education, and medication links.
- `medications/` — dosing, interactions, contraindications, pregnancy/lactation categories.
- `mbs-items/` — Australian Medicare Benefit Schedule mapping for Phase 2.
- `escalation/` — when to call 000 / refer to ED / refer in-person.
- `regulatory/` — AHPRA advertising constraints, TGA SaMD notes, Privacy Act collection notices.
- `red-book/` — emergency reference quick-lookups.

Loaded via `api/scripts/ingest-knowledge-base.ts`. Treat changes here as clinical content changes — they require Medical Director sign-off.

---

### 2.5 Design system & wireframes — `stitch_nightingale_telehealth_interface/`

Documentation and per-flow prototypes used by frontend work.

- `clinical_empathy/DESIGN.md` — the design-system specification ("Digital Bedside Manner"). Material Design 3 derivative.
  - Palette: Navy `#002045` (primary/trust), Teal `#13696a` (secondary/vitality); semantic Emerald (approved), Amber (pending), Crimson `#ba1a1a` (red flag).
  - Typography: Manrope (headlines), Public Sans (body and clinical-data tier 14px/600).
  - Spacing 8px base; patient surfaces use 32px margins, doctor surfaces use 16px for density.
  - Patient = Focus Layout (low cognitive load); Doctor = Dashboard Layout (scan-optimised).
  - Default radius 0.5rem; soft tonal elevation, minimal shadows.
- 16 flow directories — patient registration, new consultation, voice consultation, text consultation, photo upload, medical history, dashboard, results (approved/rejected), profile edit; doctor queue, review, amend, analytics; plus shared variants. Each contains `code.html` (clickable wireframe) and `screen.png` (static mock).

The frontend codebase implements these flows in `web/src/app/(patient|doctor|admin)/...` and shared components.

---

### 2.6 Infrastructure — `infra/terraform/`

Terraform 1.7+, AWS provider 5.x, region `ap-southeast-2`.

**Bootstrap** (`bootstrap/`) — one-time IAM/OIDC provider for GitHub Actions and the shared ECR repo.

**Modules** (`modules/`):

| Module | Contents |
|---|---|
| `vpc` | VPC, public/private subnets, NAT, multi-AZ. |
| `ecs` | Fargate cluster, task definitions, service, autoscaling. |
| `alb` | HTTPS ALB, target groups, health checks. |
| `rds` | PostgreSQL 15 (`t4g.small`, 50 GB, multi-AZ, 7-day backups). |
| `s3` | Photo bucket with SSE-KMS. |
| `cloudfront` | CDN in front of S3 with cache headers. |
| `ecr` | Container registry. |
| `cognito` | User pool with custom `role` and `ahpra_number` attributes; email MFA. |
| `cognito_presignup` | Lambda for auto-confirm in Phase 1. |
| `kms` | Keys for S3 and RDS encryption. |
| `iam` | ECS task roles, GitHub Actions OIDC roles. |
| `waf` | Rate limiting, IP rules. |
| `security` | Security groups, NACLs. |
| `audit_export` | CloudTrail + CloudWatch Logs Insights for compliance dashboards. |

**Environments** (`envs/staging/`, `envs/prod/`) — module composition, per-env variables, S3 + DynamoDB remote state. Prod is a separate AWS account.

---

### 2.7 CI/CD — `.github/workflows/`

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR to `main` | Lint, typecheck, Jest, Vitest, Docker build, push staging-tagged image to ECR. |
| `deploy-staging.yml` | Manual | Deploy staging image to ECS staging cluster, run migrations, smoke tests. |
| `deploy-prod.yml` | Manual with `image_tag` input | Retag a validated staging image as prod, update ECS prod service, smoke test. |
| `infra.yml` | Changes under `infra/terraform/` | `terraform plan`, post summary, gate apply on manual approval. |

Auth into AWS uses GitHub OIDC — no long-lived secrets in the repo.

---

## 3. Cross-cutting concerns

### 3.1 Authentication & RBAC

1. User signs up/in via the web app; Cognito returns ID + access tokens.
2. Frontend stores tokens **in memory only** (`web/src/lib/api.ts`) — never localStorage, never cookies.
3. Every request carries `Authorization: Bearer <token>`.
4. Backend `requireAuth` middleware validates the JWT against the Cognito user-pool JWKS via `aws-jwt-verify`, attaches `cognito_sub` and the `role` custom claim to `req.user`.
5. Role-specific endpoints add `requireRole('doctor')` / `requireRole('admin')`.
6. DB queries scope by `cognito_sub` — patients only ever see their own consultations; doctors see only their assigned queue.

### 3.2 PII handling and data residency

- All AWS resources pinned to `ap-southeast-2` by Terraform; no cross-region replication.
- Before any payload reaches an external LLM (Anthropic, Bedrock, Gemini), it passes through `services/piiAnonymiser.ts`, which strips names, DOBs, healthcare identifiers, and contact details. Anonymised context (age, sex, conditions) is what the LLM sees.
- Photos: client → API (multipart) → S3 with SSE-KMS; reads via short-lived presigned URLs.
- TLS 1.3 in transit; AES-256 at rest; RDS in private subnets without public IP.

### 3.3 Audit & compliance

- `audit_log` is append-only. Every AI output, doctor action, and patient communication is recorded with the actor's role (and AHPRA for doctors), the consultation ID, and a structured metadata payload.
- `X-Correlation-ID` is generated at the edge and propagated through Pino bindings, downstream services, and audit rows — enabling end-to-end traces.
- CloudTrail records all AWS control-plane calls; CloudWatch Logs holds application logs; `audit_export` aggregates for compliance dashboards.
- Soft delete only — patient records carry `deletion_requested_at`; never `DELETE` from `audit_log` or core clinical tables (7-year medicolegal retention).

### 3.4 Idempotency and consistency

- `POST /consultations` honours an `Idempotency-Key` header; `consultations.idempotency_key` enforces 24h dedup.
- Critical state transitions (approve, amend, reject, renewal action) run inside DB transactions and write to `audit_log` in the same transaction.
- WebSocket upgrades require a single-use token (`ws_tokens` table): issued via REST after auth, validated and immediately marked used on upgrade.

### 3.5 Observability

- Pino structured JSON logs with correlation-ID, route, user role, and timing.
- Slow queries (>500 ms) auto-warn from `db.ts`.
- Client errors (HTTP ≥ 400 visible to users) post to `/v1/client-errors` (handled by `clientError.ts`).
- Health (`/health`) checks Cognito reachability; readiness (`/ready`) checks the DB pool — the ALB uses `/ready`.

---

## 4. Consultation lifecycle

The state machine implemented across `routes/consultations.ts`, `services/clinicalAiEngine.ts`, `services/redFlagDetector.ts`, and `routes/doctor.ts`:

```
                pending
                   │  (patient starts)
                   ▼
                 active                   ◄── Gemini Live session;
                   │                          redFlagDetector running
                   │  (transcript captured)
                   ▼
            transcript_ready
                   │  (fire-and-forget → clinicalAiEngine.run())
                   │     1. piiAnonymiser
                   │     2. rag.retrieve
                   │     3. anthropicClient → SOAP + differential
                   │     4. anthropicClient → patient draft response
                   │     5. flags: LOW_CONFIDENCE / CANNOT_ASSESS / RED_FLAG
                   ▼
           queued_for_review              ◄── visible in doctor queue
                   │                          (priority sort by flag)
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
   approved     amended     rejected
       │           │           │
       │           │           └── sendRejectionEmail
       └─────┬─────┘                + in-person referral (no charge)
             ▼
       send to patient (emailService)
             │
             ▼
       scheduleFollowUp (24–48 h)
             │
             ▼
       follow-up email → patient response
             │
             ▼
       concerning response → re-open / escalate
```

Side branches:
- **Red flag** detected mid-consultation → patient instructed to call 000 immediately; consultation flagged for doctor visibility but not deferred behind review.
- **Cannot assess** (physical exam needed) → consultation marked CANNOT_ASSESS; doctor writes custom referral.
- **Audio quality poor** → fallback to `textConsultation.ts` (chat-based).

---

## 5. Deployment topology

```
                       GitHub Actions
                  (OIDC → AWS staging/prod)
                            │
                            ▼
                          ECR (api image)
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
          ECS staging              ECS production
          (Fargate)                (Fargate, retagged
                                    staging image)
                │                       │
                ├── ALB (HTTPS)         ├── ALB (HTTPS)
                ├── RDS (multi-AZ)      ├── RDS (multi-AZ)
                ├── S3 + CloudFront     ├── S3 + CloudFront
                ├── Cognito user pool   ├── Cognito user pool
                └── KMS + WAF           └── KMS + WAF

Web frontend → Vercel (separate deploy pipeline);
              `/api/v1/*` rewrites point at the ALB.
```

Promotion is intentionally indirect: prod never builds from source — it retags an image already validated in staging, eliminating drift between the two environments.

---

## 6. Where to look when…

| Task | Start here |
|---|---|
| Add a backend route | `api/src/routes/`, register in `app.ts`. Add Jest tests. |
| Add a doctor-only screen | `web/src/app/(doctor)/...` + `requireRole('doctor')` on the API side. |
| Change consultation flow | `services/clinicalAiEngine.ts` + the state machine in §4. |
| Modify an AI prompt | `clinical-knowledge/system-prompts/` (clinical-content change — needs MD approval). |
| Add a clinical guideline | `clinical-knowledge/therapeutic-guidelines/<condition>/`. |
| Add a DB column | New numbered file in `infra/database/migrations/`; never edit historical migrations. |
| Touch security middleware | `api/src/middleware/auth.ts`; reference `docs/shipped/SEC-001..005.md`. |
| Change AWS infrastructure | `infra/terraform/modules/` then env composition; PR triggers `infra.yml` plan. |
| Adjust visual design tokens | `stitch_nightingale_telehealth_interface/clinical_empathy/DESIGN.md` first, then `web/tailwind.config.ts`. |
| Investigate observability | `api/src/middleware/correlationId.ts`, `logger.ts`, `docs/shipped/OPS-001.md`. |

---

## 7. Open and intentional non-goals (Phase 1)

- **Payments** — Stripe integration is in `docs/backlog/PRD-007.md`, not yet built.
- **Medicare bulk-billing** — deferred to Phase 2 (clinic SaaS).
- **Proprietary clinical model** — `docs/backlog/PRD-019.md`. Phase 1 uses Claude + curated guidelines.
- **TGA SaMD certification** — pre-build paperwork in `docs/backlog/PREREQ-001.md`.
- **SE Asia expansion** — Year 2; Australia-only at launch.

These are documented constraints, not gaps to fill in passing.
