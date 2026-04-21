# PRD-003 — Infrastructure & DevOps

> **Status:** Not Started
> **Phase:** Sprint 0 (Week 1–2)
> **Type:** Technical — Infrastructure
> **Owner:** CTO

---

## Overview

Stand up the complete AWS infrastructure and CI/CD pipeline that all subsequent sprints build on. Everything runs in **ap-southeast-2 (Sydney)** — Australian data residency is a hard requirement for Privacy Act compliance.

---

## Background

All patient health data must remain in Australia. AWS Sydney provides full-stack Australian data residency. The choice of AWS also enables AWS Bedrock as the preferred path for LLM inference, keeping AI processing in-region and simplifying cross-border disclosure obligations.

Key infrastructure decisions required before this sprint:
- **Auth provider:** AWS Cognito vs Auth0 — see PRD-004
- **LLM inference:** AWS Bedrock (preferred) vs direct Anthropic API — decision required before Sprint 4 but architecture must be designed now
- **Database:** AWS RDS PostgreSQL (decided)

---

## Functional Requirements

### AWS Environment

| # | Requirement |
|---|-------------|
| F-001 | All AWS resources provisioned in ap-southeast-2 region |
| F-002 | VPC with public and private subnets; application layer in private subnet |
| F-003 | IAM roles following least-privilege principle; no shared credentials |
| F-004 | AWS KMS customer-managed keys for encryption at rest (RDS, S3) |
| F-005 | CloudTrail enabled for all API activity logging |
| F-006 | CloudWatch alarms for: high CPU, low disk, failed auth attempts, unusual API call volume |

### Database

| # | Requirement |
|---|-------------|
| F-007 | AWS RDS PostgreSQL, instance class db.t3.medium (scaling to db.t3.large at 500+ consultations/month) |
| F-008 | Automated daily snapshots, 30-day retention |
| F-009 | Multi-AZ standby enabled for production |
| F-010 | Database accessible only from application layer (private subnet); no public endpoint |
| F-011 | TLS required for all database connections |

### Object Storage

| # | Requirement |
|---|-------------|
| F-012 | S3 bucket for medical photos: `nightingale-photos-prod` (ap-southeast-2) |
| F-013 | S3 bucket for audit logs: `nightingale-audit-prod` (ap-southeast-2) |
| F-014 | S3 bucket for application assets: `nightingale-assets-prod` (ap-southeast-2) |
| F-015 | AES-256 encryption (SSE-KMS with customer-managed keys) on all buckets |
| F-016 | Public access blocked on all buckets |
| F-017 | Object lock (WORM) enabled on audit log bucket; 7-year retention policy |
| F-018 | Versioning enabled on photos and audit log buckets |

### CI/CD Pipeline

| # | Requirement |
|---|-------------|
| F-019 | GitHub Actions workflows for: lint, test, build, deploy |
| F-020 | Two environments: `staging` (ap-southeast-2) and `prod` (ap-southeast-2) |
| F-021 | PR to `main` triggers staging deploy automatically |
| F-022 | Production deploy requires manual approval step in GitHub Actions |
| F-023 | Environment variables and secrets managed via AWS Secrets Manager; never committed to git |
| F-024 | Docker containers deployed to AWS ECS Fargate |

### Networking & Security

| # | Requirement |
|---|-------------|
| F-025 | AWS WAF in front of application load balancer |
| F-026 | TLS 1.3 enforced on all external endpoints (ALB + CloudFront) |
| F-027 | Security groups: application layer accepts traffic only from ALB; database accepts traffic only from application |
| F-028 | VPC Flow Logs enabled |

---

## Non-Functional Requirements

- **Availability:** 99.5% uptime target (SLA not committed to patients at launch)
- **Backup:** RDS automated backups daily; tested monthly
- **Security:** AWS Essential Eight Maturity Level 2 before beta launch
- **Cost:** Infrastructure within ~$260 AUD/month at Phase 1 volumes (RDS ~$80 + EC2/ECS ~$150 + S3 ~$30)

---

## Acceptance Criteria

- [ ] All resources provisioned in ap-southeast-2 with IaC (Terraform or AWS CDK) committed to repo
- [ ] Staging and prod environments both operational
- [ ] CI/CD pipeline runs on every PR: lint → test → build → staging deploy
- [ ] Production deploy requires manual approval
- [ ] No secrets in git history; all secrets in AWS Secrets Manager
- [ ] RDS instance reachable only from application subnet; no public endpoint
- [ ] All S3 buckets encrypted, public access blocked
- [ ] Audit log S3 bucket has object lock + 7-year retention configured
- [ ] CloudTrail and CloudWatch alarms active
- [ ] TLS 1.3 enforced on all external endpoints

---

## Dependencies

- PRD-001: Legal sign-off on data residency approach (AWS Bedrock vs Anthropic API) before finalising architecture

---

## Out of Scope

- Multi-region failover (Phase 2)
- CDN (CloudFront) for patient media (Phase 2, evaluate need after beta)
- Auto-scaling ECS beyond manual right-sizing (Phase 2)
