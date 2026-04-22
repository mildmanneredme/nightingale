# Feature Development Framework

> A reference standard for how Nightingale plans, builds, ships, and operates features.
> Applies to all product development from Sprint 1 onwards.

**Last updated:** 2026-04-22

---

## Table of Contents

1. [Principles](#1-principles)
2. [PRD Standards](#2-prd-standards)
3. [Requirements Engineering](#3-requirements-engineering)
4. [Development Standards](#4-development-standards)
5. [Security & Compliance by Default](#5-security--compliance-by-default)
6. [Testing Philosophy](#6-testing-philosophy)
7. [Definition of Done](#7-definition-of-done)
8. [Deployment & Release](#8-deployment--release)
9. [Observability](#9-observability)
10. [Post-Ship Operations](#10-post-ship-operations)

---

## 1. Principles

These govern every decision in this framework. When rules conflict, fall back to these.

### 1.1 Ship working software, not documentation

A PRD is a means to alignment, not an end in itself. Every written word costs time to maintain. Write what is needed to build correctly and to audit later — nothing more.

### 1.2 Compliance is architecture, not afterthought

For a healthcare platform, compliance constraints (AHPRA, Privacy Act, TGA, medicolegal audit) are first-class design inputs. They must be incorporated at spec time, not bolted on before launch.

### 1.3 The HITL contract is inviolable

No AI output reaches a patient without a credentialed GP approving it. This is not a feature — it is the platform's core safety guarantee. Any implementation that weakens this, even temporarily, is not acceptable.

### 1.4 Minimise attack surface

Build only what the current sprint requires. Do not add abstraction, extensibility, or feature flags for hypothetical future needs. Scope creep in a healthcare system is a security and liability risk, not just a productivity cost.

### 1.5 Prefer boring technology

AWS-native services over third-party SaaS where feasible (data residency, DPA simplicity). Established patterns over clever ones. Debuggability over elegance.

### 1.6 Immutable audit trail on everything clinical

Every AI output, doctor action, patient communication, and payment event must be written to an append-only audit log before the operation completes. There is no exception to this rule.

---

## 2. PRD Standards

### 2.1 When to write a PRD

Write a PRD for every feature or system component that:
- Has external user-facing behaviour (patient, doctor, or admin)
- Generates or processes clinical data
- Introduces a new third-party integration
- Has compliance, audit, or medicolegal implications
- Will take more than one day to implement

For internal refactors or pure infrastructure changes with no user-visible behaviour change, a GitHub issue with a technical spec is sufficient.

### 2.2 PRD lifecycle

```
backlog/  →  (sprint planning)  →  in progress  →  docs/shipped/
```

- **Backlog:** `docs/backlog/PRD-NNN-<slug>.md` — approved and prioritised, not yet started
- **In progress:** Status header updated to "In progress"; no file move
- **Shipped:** Move to `docs/shipped/PRD-NNN-<slug>.md`; update `docs/backlog/ROADMAP.md`

PRD numbering is sequential and permanent. Never reuse a number.

### 2.3 PRD template

Every PRD must include the following sections. Omit a section only if it genuinely does not apply, and state why.

```markdown
# PRD-NNN — [Feature Name]

> **Status:** [Backlog | In progress | Shipped YYYY-MM-DD]
> **Phase:** [Pre-build | Sprint N (Week N–N)]
> **Type:** [Patient-facing | Doctor-facing | Internal | Infrastructure]
> **Owner:** [CTO | Medical Director | Founder]

---

## Overview

[2–4 sentences. What this is, why it exists, and what user problem it solves.]

## Background

[Context required to understand the constraints. Prior decisions. Research findings.
Link to relevant research docs. Keep short — if extensive context exists, link to it.]

## User Roles & Access

[Which roles interact with this feature and how. Critical for RBAC design.]

## Functional Requirements

[Numbered table format: F-NNN | Requirement]

## Non-Functional Requirements

[Performance, availability, security, data residency, audit requirements.
Include explicit audit log events if this PRD generates clinical or payment data.]

## Compliance Notes

[AHPRA language constraints, TGA considerations, Privacy Act obligations, medicolegal requirements.
Mark N/A if genuinely not applicable.]

## Acceptance Criteria

[Checkbox list. Each item must be verifiable — testable by a reviewer who didn't write the code.
Items that cannot be verified today are moved to Out of Scope.]

## Dependencies

[Which PRDs must be shipped before this one. Reference by PRD number.]

## Out of Scope

[Explicit list of what this PRD does NOT cover, to prevent scope creep.]
```

### 2.4 PRD quality checklist

Before a PRD is accepted into a sprint:

- [ ] All functional requirements are unambiguous — a developer can implement them without asking follow-up questions
- [ ] Acceptance criteria are verifiable, not aspirational ("password field validates on blur" not "good UX")
- [ ] Audit log events are explicitly listed for any clinical, payment, or auth data
- [ ] AHPRA language constraints applied to any patient-facing copy in the spec
- [ ] Data residency is explicitly addressed for any new third-party integration
- [ ] Out of Scope section explicitly excludes anything that might be assumed to be included

---

## 3. Requirements Engineering

### 3.1 Functional requirements

Write functional requirements in the form:
> **[Actor] can/must [action] [object] [condition if any]**

Examples:
- *Patient can start a consultation only after payment is confirmed*
- *Doctor must provide a reason when rejecting a consultation*
- *System must write a `consultation.ai_output_generated` event to the audit log before surfacing output to the doctor*

Number them `F-NNN` within the PRD. Numbers within a PRD are permanent — do not renumber if requirements are removed; mark them `[Removed]` instead. This preserves traceability when acceptance criteria reference requirement numbers.

### 3.2 Non-functional requirements

Standard non-functional requirements to address for every feature:

| Category | Default unless specified otherwise |
|----------|-----------------------------------|
| Data residency | All patient data and processing in `ap-southeast-2` |
| Encryption at rest | AES-256 / AWS KMS CMK |
| Encryption in transit | TLS 1.3 minimum |
| Audit logging | All clinical, auth, and payment events to `audit_log` table (append-only) |
| RBAC | Role-scoped at API layer; never enforced at UI layer only |
| Session auth | JWT; 15-min access token; 7-day refresh with rotation |
| Error messages | Never expose internal state, stack traces, or PII in error responses |

### 3.3 Acceptance criteria format

Each acceptance criterion must be:
- **Checkboxable** — binary pass/fail, not a matter of opinion
- **Scoped** — names the specific component or behaviour being verified
- **Implementation-neutral** — tests the outcome, not how it's achieved

Good: `[ ] Attempting to access /api/doctor/** with a patient JWT returns 403`
Bad: `[ ] Access control is implemented`

When a PRD ships, each acceptance criterion is checked off and any deviations from the original spec are documented inline (see PRD-004 for example). Deviations must not weaken the original intent — if a deviation weakens a security or clinical requirement, it must be approved by the Medical Director (clinical) or a qualified reviewer (technical).

---

## 4. Development Standards

### 4.1 Core engineering principles

**Build only what is required.** YAGNI (You Aren't Gonna Need It) is the default. Three similar lines of code are better than a premature abstraction. If the use case does not exist yet, do not build for it.

**Validate at system boundaries only.** Trust internal code and framework contracts. Only validate user input, external API responses, and data crossing trust boundaries. Internal-to-internal calls do not need defensive null-checks on fields the callee always sets.

**Prefer explicit over implicit.** Explicit role checks over middleware magic. Explicit audit log writes over triggers. Explicit error messages over silent failures. Code that states what it does is cheaper to audit and cheaper to debug.

**No inline credentials or PII in code.** All secrets via AWS Secrets Manager or environment variables. No patient identifiers, AHPRA numbers, or health data in logs. No PII in URLs (query params or path segments).

**Match blast radius to scope.** A patient-facing feature change should not touch doctor-facing infrastructure. A database migration should not be bundled with a UI change. Separate concerns both in code and in commits.

### 4.2 Code organisation

Follow the existing IaC structure:
- Infrastructure changes: Terraform, `ap-southeast-2` region, reviewed against data residency constraints
- API: AWS Lambda + API Gateway (or ECS services); routes grouped by role
- Auth: all auth logic through the Cognito pre-auth Lambda; no custom auth bypass paths

### 4.3 Dependency management

- Introduce a new third-party dependency only if: (a) the same functionality cannot be achieved with an existing dependency or AWS-native service, and (b) the dependency's data exposure has been assessed against APP 8 and a DPA is executed before patient data flows through it
- Pin major versions; patch versions can auto-update via Dependabot
- Run `npm audit` / equivalent in CI; block merge on high-severity findings

### 4.4 Comments and documentation

Write no comments by default. Add a comment only when the **why** is non-obvious:
- A hidden constraint (regulatory, medicolegal, or infrastructure)
- A workaround for a specific third-party limitation (document the limitation and ticket link)
- A counterintuitive invariant that would surprise a future reader

Do not comment what the code does — well-named identifiers do that. Do not reference the ticket, PR, or person who wrote the code in a comment — that belongs in git history.

---

## 5. Security & Compliance by Default

### 5.1 Authentication & authorisation

- Every API endpoint requires authentication. There are no public data endpoints.
- Role enforcement is always at the API layer. UI-level hiding is cosmetic only.
- Doctor endpoints enforce consultation assignment at the query level — a doctor cannot retrieve a consultation not in their queue, even with a valid doctor JWT.
- Admin endpoints are inaccessible to patient and doctor JWTs. Errors return 403, not 404 (do not leak endpoint existence).

### 5.2 Clinical data handling

- Patient data sent to external AI APIs (Bedrock, voice platform) must be anonymised before transmission. The anonymisation step must strip: name, DOB, Medicare number, phone, email, address. Retain only clinical content.
- AI model outputs must pass confidence threshold validation before being surfaced to the doctor queue. Sub-threshold outputs are flagged, not silently discarded.
- Photo storage: separate S3 bucket, EXIF stripping on upload, short-lived signed URLs scoped to individual consultation, no public-read ACL.

### 5.3 AHPRA language constraints

These apply to **all patient-facing copy** — PRD specs, UI strings, notification templates, AI draft response templates:

| Prohibited | Required substitute |
|-----------|---------------------|
| diagnose / diagnosis | assess / assessment |
| prescribe (in patient-facing) | recommend |
| you have [condition] | "consistent with" / "may indicate" |
| cure | treat / manage |
| 911 | 000 |
| Any clinical outcome testimonial | Not permitted |

Every patient-facing draft must include: *"This advice is not a substitute for in-person medical care."* Emergency presentations include a reference to 000.

All AHPRA-constrained copy in the system (system prompts, notification templates, UI strings) must be reviewed and signed off by the Regulatory Advisor before it reaches a patient.

### 5.4 Audit log obligations

The following events **must** be written to `audit_log` before the operation completes (not after):

| Event category | Required events |
|---------------|----------------|
| Auth | login, logout, failed login (×5 triggers lockout), token refresh, MFA verification |
| Consultation | created, payment_confirmed, ai_consultation_started, ai_consultation_ended, ai_output_generated, doctor_queued |
| Doctor actions | review_opened, approved, amended (with diff), rejected (with reason) |
| Patient notifications | response_sent (with delivery status) |
| Payments | payment_initiated, payment_confirmed, payment_refunded |
| Admin | doctor_account_created, doctor_account_deactivated, audit_log_viewed |

Audit log rows are append-only. No update or delete path. See PRD-005 for schema.

### 5.5 Secret management

- All secrets (API keys, DB credentials, JWT signing keys) stored in AWS Secrets Manager
- Secrets are rotated on a schedule; no secret has an infinite TTL
- Lambda/ECS tasks access secrets via IAM role; no hardcoded ARNs in application code
- CI/CD pipelines use IAM roles, not long-lived access keys

---

## 6. Testing Philosophy

### 6.1 Test what matters most

Test at the level that gives you the most confidence for the least maintenance cost:

| Layer | What to test | Avoid |
|-------|-------------|-------|
| Unit | Pure functions, business logic, validation rules | Infrastructure, I/O |
| Integration | API routes with real DB (not mocks), auth middleware, audit log writes | Mocking the database |
| End-to-end | Critical user journeys: patient registration → payment → consultation start; doctor review → approve → notification sent | Flaky browser tests for edge cases |

Avoid mocking the database in integration tests. Mocked tests that pass do not guarantee that schema migrations, constraints, or query changes work correctly — this project has experienced this before.

### 6.2 Clinical safety testing

The following must be explicitly tested before any Sprint 2+ feature ships:

- **HITL gate:** A test must confirm that no consultation response object can be sent to a patient notification endpoint without a `doctor_approved_at` timestamp and `doctor_id` present
- **Red flag escalation:** The AI consultation flow must be tested with emergency symptom inputs; output must route to 000 instruction, not to the doctor queue
- **AHPRA language check:** A linter or test assertion must verify that no patient-facing string contains prohibited language (`diagnose`, `prescribe`, `you have [condition]`, `911`)

### 6.3 Security regression tests

- Unauthenticated requests to all non-public endpoints return 401
- Patient JWT cannot access doctor or admin routes (403)
- Doctor JWT cannot retrieve consultations outside their queue (403, not 404)
- Anonymous patient flag correctly restricts clinical AI scope

### 6.4 CI requirements

- All tests pass before merge to `main`
- `npm audit` (or equivalent) — block on high severity
- Terraform `plan` output reviewed in PR for infra changes
- No secrets in committed code (secret scanning in CI)

---

## 7. Definition of Done

A feature is **done** when all of the following are true:

### Code

- [ ] All acceptance criteria from the PRD are checked off
- [ ] Any deviations from the original spec are documented in the PRD with rationale
- [ ] Unit and integration tests pass; coverage adequate for clinical paths
- [ ] No new high-severity security findings from dependency audit
- [ ] Code reviewed and approved by at least one other engineer

### Compliance

- [ ] All required audit log events are implemented and verified (write before operation completes)
- [ ] No PII in logs or error responses
- [ ] Patient-facing copy passes AHPRA language check
- [ ] Data residency: new integrations confirmed in `ap-southeast-2` or explicitly assessed

### Clinical (Sprint 2+)

- [ ] Medical Director has reviewed and approved any changes to AI system prompts, question trees, or patient-facing response templates
- [ ] HITL gate test passes: no response reaches patient without doctor approval
- [ ] Red flag escalation test passes if consultation flow is modified

### Deployment

- [ ] Infrastructure changes applied via Terraform (not console)
- [ ] Migrations tested against staging DB before production
- [ ] Feature verified in staging environment end-to-end
- [ ] Rollback procedure documented if the change is non-trivial to reverse

### Documentation

- [ ] PRD moved to `docs/shipped/` with shipped date
- [ ] `docs/backlog/ROADMAP.md` updated
- [ ] Any known deferred items or open decisions recorded in the PRD or a follow-up ticket

---

## 8. Deployment & Release

### 8.1 Environment strategy

| Environment | Purpose | Data |
|------------|---------|------|
| `dev` | Local development; individual developer sandboxes | Synthetic data only; no real patient data |
| `staging` | Integration testing; pre-production validation | Synthetic data; mirrors production infrastructure |
| `production` | Live service | Real patient data; full compliance obligations apply |

No real patient data ever enters `dev` or `staging`. Test against synthetic data generated to match production schema and clinical scenarios.

### 8.2 Infrastructure-as-code discipline

- All infrastructure changes are in Terraform. Zero manual console changes.
- Every `terraform apply` to production is preceded by a `terraform plan` reviewed in the PR.
- State is stored in S3 with DynamoDB lock; never stored locally.
- Infrastructure PRs follow the same PRD acceptance criteria and Definition of Done as feature PRs.

### 8.3 Database migrations

Migrations are the highest-risk deployment artifact. Follow this protocol:

1. Write migration as a separate commit from application code
2. Test migration against a staging DB clone before merging
3. Migrations must be backward-compatible with the currently deployed application version (blue/green safety)
4. `RDS encryption must be enabled at creation` — cannot be added after the fact (this is a known constraint; do not create unencrypted instances even temporarily)
5. Rollback: every migration ships with a corresponding `down` migration; test it

### 8.4 Deployment checklist

Before deploying to production:

- [ ] Staging deployment verified end-to-end (critical user journeys pass)
- [ ] DB migration (if any) tested against staging; `down` migration tested
- [ ] Third-party DPAs in place for any new integration receiving patient data
- [ ] Secrets rotated/updated in Secrets Manager (not hard-coded)
- [ ] Rollback procedure documented and understood
- [ ] Deployment window communicated if it affects doctor review availability

### 8.5 Rollback

Every production deployment must have a defined rollback path before it is deployed:

- **Code:** Previous container image / Lambda version available for immediate redeploy
- **Database:** Migration `down` script tested and ready; point-in-time recovery (PITR) enabled on RDS
- **Infrastructure:** Terraform state allows reverting to previous configuration
- If a clinical safety issue is discovered post-deploy, the rollback decision is made immediately without waiting for root cause analysis

### 8.6 No feature flags for clinical paths

Feature flags in a clinical system create code paths that diverge from what was tested and approved. Do not use feature flags to gate clinical logic (AI prompts, HITL gate, red flag escalation, doctor approval flow). Use them only for non-clinical UI experiments if ever introduced.

---

## 9. Observability

### 9.1 What to instrument

Every feature that ships must include instrumentation for:

| Signal | What | Tooling |
|--------|------|---------|
| Errors | 5xx rate, unhandled exceptions | CloudWatch Logs + Alarms |
| Latency | P50/P95/P99 for critical API routes | CloudWatch Metrics |
| Clinical throughput | Consultations created, queued, approved, rejected per hour | CloudWatch custom metrics |
| Doctor queue depth | Pending reviews (SLA proxy) | CloudWatch Alarm if > threshold |
| AI output quality | Approval rate, amendment rate, rejection rate per week | Stored in DB; reported manually until analytics sprint |
| Audit log write failures | Any failure to write an audit event | CloudWatch Alarm — critical alert |

### 9.2 Alerts

Alerts must fire **before** the user experiences a problem where possible:

| Condition | Severity | Response |
|-----------|---------|----------|
| Audit log write failure | Critical | Page on-call immediately; halt associated operation if possible |
| Doctor queue depth > 10 pending | High | Notify doctor; escalate to on-call after 30 min |
| AI output generation failure | High | Notify on-call; consultation enters manual triage |
| 5xx error rate > 1% over 5 min | High | On-call investigates |
| Failed login attempts > 10/min from one IP | Medium | Auto-block + alert |
| HITL gate bypassed (no `doctor_approved_at`) | Critical | Block send; alert immediately |

### 9.3 Structured logging

Log in structured JSON. Every log entry includes:
- `timestamp` (ISO 8601)
- `level` (info / warn / error)
- `service` (which Lambda / ECS task)
- `consultation_id` (if applicable) — never include patient PII in logs
- `request_id` (for correlation)
- `actor_role` (patient / doctor / admin / system)

Never log: patient name, DOB, Medicare number, AHPRA number, consultation content, photo URLs (even signed), payment card data.

---

## 10. Post-Ship Operations

### 10.1 Success metrics tracking

Each shipped PRD defined success metrics at spec time. Review them at the sprint retrospective:

| PRD type | Review cadence | Owner |
|---------|---------------|-------|
| Clinical features (AI, doctor queue, HITL) | Weekly during beta | CTO + Medical Director |
| Patient-facing features | End of sprint | CTO |
| Infrastructure / compliance | Monthly | CTO |

Clinical metrics to track from Sprint 2 onwards:
- AI draft approval rate (no amendment needed) — baseline target: establish in beta
- Amendment rate — signals systematic AI quality issues requiring prompt work
- Rejection rate — signals scope creep beyond remote consult capability
- Average doctor review time — target < 5 min; exceeding this signals dashboard UX issues
- Red flag escalation rate — any unexpected spike warrants immediate clinical review

### 10.2 Incident response

When a production incident occurs:

1. **Triage** — is this a clinical safety issue or a technical issue? Clinical safety issues (HITL bypass, wrong patient data exposed, AI output delivered without approval) are Priority 1 regardless of scale.
2. **Contain** — limit the blast radius. Take affected features offline if needed; do not attempt to fix-in-place while users are being affected.
3. **Communicate** — notify the Medical Director of any clinical safety incident immediately, regardless of hour. Notify the Regulatory Advisor of any data breach or potential NDB-notifiable event.
4. **Resolve** — deploy the fix through normal deployment process (no `--no-verify`, no skipping tests).
5. **Post-mortem** — written within 48 hours; includes timeline, root cause, immediate fix, and systemic improvements.

### 10.3 Post-mortem format

```markdown
## Incident: [Short description] — [YYYY-MM-DD]

**Severity:** P1 / P2 / P3
**Duration:** [start time] → [resolution time]
**Patient impact:** [None / N patients affected / Clinical safety implication]

### Timeline
[Chronological events with timestamps]

### Root cause
[Single, specific root cause — not "human error"]

### Immediate fix
[What was deployed to stop the bleeding]

### Systemic improvements
[What changes to process, code, or monitoring prevent recurrence]
[Owner and target date for each item]
```

### 10.4 AI quality governance

The Medical Director conducts a monthly review of AI output quality. Inputs:
- Amendment rate by consultation category (URTI, UTI, skin, etc.)
- Rejection rate and rejection reasons
- Any cases where the doctor noted the AI output was clinically misleading
- Confidence threshold performance (how often outputs are sub-threshold)

Any systematic quality issue triggers a prompt review process:
1. CTO + Medical Director review the affected question tree / system prompt
2. Medical Director proposes amendments
3. Amendments tested on synthetic consultations
4. Medical Director approves via PR review on the `question-trees/` branch
5. Deployed in next sprint

All clinical prompt changes are tracked in git with the Medical Director's approval recorded in the PR. This is the audit trail for TGA SaMD compliance.

### 10.5 Knowledge retention

Decisions and their rationale must be recorded so future team members understand the constraints:

- **Architecture decisions:** Significant technical choices (Bedrock over direct API, Cognito over Auth0) are recorded in the relevant PRD's Background section
- **Regulatory decisions:** Compliance interpretations are recorded in the relevant PRD's Compliance Notes section
- **Research findings:** Kept in `docs/research/archive/` with date-stamped filenames
- **Open decisions:** Tracked in `docs/backlog/ROADMAP.md` under "Key Open Decisions" with owner and required-by date

Do not record transient state (in-progress work, current sprint status, what was done last week) in permanent documents. That belongs in sprint tracking tools or conversation. Permanent documents should be readable and accurate six months after they are written.

---

## Appendix A — PRD numbering registry

| Range | Category |
|-------|---------|
| 001–002 | Pre-build (regulatory, research) |
| 003–005 | Sprint 0 (infrastructure, auth, audit) |
| 006–007 | Sprint 1 (patient registration, payments) |
| 008–009 | Sprint 2 (AI voice, text fallback) |
| 010–011 | Sprint 3 (photo upload, knowledge base) |
| 012 | Sprint 4 (clinical AI engine) |
| 013–014 | Sprint 5 (doctor dashboard, notifications) |
| 015–016 | Sprint 6 (follow-up, beta launch) |
| 017+ | Future sprints — assign sequentially |

---

## Appendix B — Third-party DPA register

A DPA must be executed before patient data flows through a vendor. Track status here; full DPA documents stored in legal folder.

| Vendor | Data exposure | DPA status | AU data residency |
|--------|-------------|-----------|------------------|
| AWS Bedrock (ap-southeast-2) | Anonymised clinical content for AI inference | Standard AWS DPA — included in AWS account agreement | Confirmed — ap-southeast-2 |
| Vapi / Retell.ai | Live audio, transcript fragments | Required before Sprint 2 | Must confirm — AU or no post-session retention |
| Twilio | Patient name, phone, SMS content | Required before Sprint 5 | Use AU residency option |
| SendGrid | Patient name, email, doctor response | Required before Sprint 5 | Confirm scope |
| Stripe | Payment data + consultation context | Required before Sprint 1 | Confirm with healthcare lawyer |

---

## Appendix C — AHPRA language quick reference

| Never use | Use instead |
|-----------|------------|
| diagnose / diagnosis | assess / assessment |
| prescribe (patient-facing) | recommend |
| you have [condition] | consistent with / may indicate |
| cure | treat / manage |
| 911 | 000 |
| [clinical outcome testimonial] | Not permitted in any form |

Every patient-facing response must include:
> *"This advice is not a substitute for in-person medical care."*

Emergency presentations must include a reference to calling **000**.
