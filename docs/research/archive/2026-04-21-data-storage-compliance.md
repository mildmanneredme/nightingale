# Research: Data Storage Requirements — Domicile & Security

> **Status:** Research Complete — April 2026
> **Decision needed by:** Before Sprint 0 (infrastructure setup) — these requirements directly shape AWS configuration, third-party contracts, and architecture decisions
> **Owner:** CTO + Healthcare Regulatory Lawyer

---

## Research Question

What are the legal requirements and appropriate security standards for storing patient health data in Project Nightingale, given that:

- The platform collects sensitive health information under the Privacy Act 1988
- All clinical data (transcripts, SOAP notes, differential diagnoses, medical photos, patient histories) is stored
- Third-party services process parts of this data (Anthropic Claude API, Vapi/Retell.ai, Twilio, SendGrid, Stripe)
- The platform will be regulated as a SaMD under TGA (likely Class IIa)
- The GP partner bears AHPRA clinical liability on every approved consultation

---

## 1. Data Domicile

### What the law actually requires

There is **no blanket legal requirement** that Australian health data be stored within Australia — for a private telehealth company. The restriction that comes closest is **My Health Records Act 2012 s77**, which mandates Australian residency for MHR system data. **This does not apply to Nightingale unless we integrate with the national My Health Record system.** Our consultation records, transcripts, and SOAP notes are not MHR data unless we explicitly opt in to that integration (Phase 2 consideration, not Phase 1).

**State laws** (NSW HRIPA 2002, VIC Health Records Act 2001, QLD, SA, WA, NT equivalents) do not impose additional data residency mandates beyond the federal Privacy Act. They add enforcement and patient access rights, not geography requirements.

### APP 8 — the real obligation

The operative obligation is **Australian Privacy Principle 8 (Cross-border Disclosure)**. APP 8 does not prohibit offshore storage or processing — it governs *accountability*. Key requirements:

1. **Accountability stays with Nightingale.** If an overseas recipient mishandles patient data, Nightingale is liable as if it mishandled the data itself. The accountability cannot be transferred by contract.
2. **Before disclosing to an overseas recipient**, Nightingale must take reasonable steps to ensure the recipient will handle the information in compliance with the APPs (excluding APP 1).
3. The primary mechanism for satisfying APP 8 is a **Data Processing Agreement (DPA)** with each overseas service that processes patient data.

### Third-party service classification

Each third-party service must be assessed against APP 8. The key question is: does patient-identifiable health information flow to this service?

| Service | Data Exposure | APP 8 Status | Action Required |
|---------|--------------|-------------|----------------|
| **AWS ap-southeast-2** | All patient data (primary store) | **Domestic — no APP 8 trigger** | No DPA for cross-border; standard AWS data processing agreement applies |
| **Anthropic Claude API** (direct) | Anonymised consultation data (per current architecture) | APP 8 triggered — US-based | Execute DPA; confirm no training on customer data (commercial API terms do cover this, but get it in writing) |
| **AWS Bedrock (Anthropic models)** | Anonymised consultation data | AWS ap-southeast-2 keeps data in Australia | **Strongly preferred path** — eliminates cross-border disclosure and simplifies APP 8 compliance significantly |
| **Vapi / Retell.ai** (voice AI) | Live audio, transcript fragments | APP 8 triggered if US-hosted | Check whether AU data residency option exists; if not, execute DPA; confirm data not retained post-session |
| **Deepgram / Azure Whisper** (transcription) | Live audio | APP 8 triggered if US-hosted | DPA required; Azure has AU data centres — preferred option if switching |
| **Twilio** (SMS) | Patient name, phone number, message content | APP 8 triggered | DPA required; Twilio supports AU data residency for some products |
| **SendGrid** (email) | Patient name, email, doctor response content | APP 8 triggered | DPA required |
| **Stripe** (payments) | Patient name, payment data | APP 8 triggered; but Stripe's own PCI DSS obligations are extensive | Stripe's DPA typically covers this; confirm scope |

**Critical architectural note:** The current NIGHTINGALE.md spec correctly requires that **patient data is anonymised before being sent to external LLM APIs**. This anonymisation layer significantly reduces (but does not eliminate) APP 8 risk for the Claude API integration, because de-identified data may fall outside the definition of "personal information" under the Privacy Act. Maintain and audit this layer rigorously.

### Recommended domicile architecture

| Data Category | Storage Location | Rationale |
|--------------|----------------|-----------|
| Patient records, consultation transcripts, SOAP notes, audit logs | AWS RDS ap-southeast-2 (Sydney) | Primary residency; no APP 8 issue |
| Medical photos | AWS S3 ap-southeast-2 (Sydney) | Primary residency; separate access controls |
| AI inference (anonymised) | AWS Bedrock ap-southeast-2 (Sydney) via Anthropic models | Keeps AI processing in-country; eliminates APP 8 cross-border trigger |
| Backups | AWS ap-southeast-2 + secondary AU region (Melbourne / ap-southeast-4) | Disaster recovery; no data leaves Australia |
| Email delivery metadata | SendGrid (US) with DPA | Unavoidable for email delivery; contractual APP 8 coverage required |

**Recommendation: Use AWS Bedrock rather than the direct Anthropic API.** It is the single most impactful architectural decision for data residency. It keeps AI inference in Sydney, eliminates the most complex third-party DPA negotiation, and means no patient data (even anonymised) leaves Australian jurisdiction during AI processing.

### Notifiable Data Breaches (NDB) scheme

Under the **Privacy Act 1988 Part IIIC** (as strengthened by the 2024 amendments):

- Eligible data breach = unauthorised access/disclosure of personal information that is **likely to result in serious harm** to any individual
- Notification required to: affected individuals + OAIC
- Timeline: **within 30 days** of becoming aware of an eligible breach
- Penalties (2024): up to **AUD 3.3M** for serious or repeated breaches (individuals: up to AUD 660,000)
- Health records are explicitly high-risk categories; any breach involving health data will be treated as presumptively likely to cause serious harm

The NDB scheme does not prescribe storage locations, but it does implicitly require that breach detection, containment, and notification are operationally possible — meaning audit logging and access monitoring are not optional.

---

## 2. Security Requirements

### ASD Essential Eight — effectively mandatory

The **Australian Signals Directorate Essential Eight** is the baseline security framework for Australian organisations. It is not legally mandatory for private companies — but:

- **Cyber insurance** in Australia now requires Essential Eight Maturity Level 1 (ML1) as a minimum; you will not get health sector coverage without it
- The 2024 Privacy Act amendments treat regular security testing and patch management as "reasonable steps" under the APP 11 security obligation — Essential Eight operationalises this
- AHPRA expects practitioners (including those operating telehealth platforms under AHPRA registration) to meet contemporary security standards

**Essential Eight controls relevant to Nightingale:**

| Control | Application to Nightingale |
|---------|--------------------------|
| Application control | Restrict unauthorised software execution in production environments |
| Patch applications | Monthly (or sooner for critical) patching of all app dependencies |
| Configure macro settings | Not directly applicable (not a Windows desktop product) |
| User application hardening | Browser hardening for doctor review queue (CSP, HTTPS-only) |
| Restrict admin privileges | IAM roles with least-privilege; no standing admin access to production |
| Patch operating systems | EC2/ECS base images on current patches; use managed services (ECS Fargate) to reduce OS exposure |
| Multi-factor authentication | **Mandatory** for all doctor and admin logins; TOTP or hardware key minimum |
| Regular backups | Daily encrypted backups; tested restore capability quarterly |

**Target: Essential Eight Maturity Level 2 before launch.** ML1 is the minimum; ML2 is achievable for a greenfield build and demonstrates commitment to regulators, doctors, and future enterprise customers.

### TGA Class IIa SaMD cybersecurity requirements

If TGA classifies the platform as a Class IIa Software as a Medical Device (which the HITL architecture supports), additional cybersecurity obligations apply under the **TGA's Software as a Medical Device regulatory guidance**:

- **Cybersecurity risk management** integrated into the overall device risk management process (ISO 14971)
- **Software Bill of Materials (SBOM)** — a complete inventory of all software components, libraries, and dependencies
- **Upgrade and patch pathway** — documented process for addressing newly discovered vulnerabilities, especially in AI model components
- **Resilience against adversarial inputs** — for AI components specifically: documented consideration of data poisoning, prompt injection, and model manipulation attack vectors
- **Post-market surveillance** — ongoing monitoring of security vulnerabilities post-deployment

These requirements are not optional for SaMD classification and must be in the Technical File submitted to TGA.

### ISO/IEC 27001 and SOC 2

| Framework | Mandatory? | Recommendation |
|-----------|-----------|----------------|
| **ISO 27001** | No — not legally required for private health tech | Pursue after Series A; required by enterprise/clinic clients (Phase 2 SaaS model) |
| **SOC 2 Type II** | No | Pursue after Series A; materially strengthens the platform's credibility with doctor partners and enterprise customers |
| **IRAP** | No — IRAP is for Australian Government agencies handling PROTECTED classified data | Do not pursue unless contracting with a government health agency; irrelevant for D2C telehealth |

### Encryption standards

| Data State | Standard | Notes |
|------------|---------|-------|
| At rest (RDS) | AES-256 | Enable AWS RDS encryption at creation; cannot be added post-creation |
| At rest (S3 photos) | AES-256 | Server-side encryption (SSE-KMS) with customer-managed keys |
| In transit | TLS 1.3 | TLS 1.2 is outdated; enforce 1.3 minimum at load balancer and API gateway; the 2024 regulatory expectation is TLS 1.3 |
| Key management | AWS KMS | Customer-managed keys (CMK) for medical records; automatic rotation enabled; no shared keys between environments |
| Medical photos (additional) | Separate S3 bucket + bucket policy | Photos require access control beyond standard RBAC — only the assigned reviewing doctor can access photos for a specific consultation |

### Access control requirements

- **Role-based access control (RBAC):** three roles as specified — patient, doctor, admin. No cross-role data access.
- **Doctor data scoping:** a GP must only be able to see consultations assigned to them, or consultations pending review in the queue. No doctor should have bulk access to the patient list.
- **Admin access:** admin role must not have production database access by default; break-glass access only, with audit log entry required.
- **No standing privileged access:** production infrastructure access via IAM roles with time-limited session tokens; no long-lived access keys.
- **MFA on all non-patient accounts:** doctor and admin logins require TOTP MFA as a hard gate, not optional.

### Audit log requirements

The immutable audit log is both a medicolegal and privacy compliance requirement:

| Log Event | Required Fields | Retention |
|-----------|----------------|-----------|
| Consultation created | Consultation ID, patient ID (hashed), timestamp | 7 years |
| AI output generated | Consultation ID, model version, confidence scores, timestamp | 7 years |
| Doctor action (approve/amend/reject) | Consultation ID, doctor AHPRA number, action type, timestamp, amendment diff if applicable | 7 years |
| Patient notification sent | Consultation ID, channel (email/SMS), timestamp | 7 years |
| Photo uploaded/accessed | Consultation ID, actor role, timestamp | 7 years |
| Login/logout | Actor ID, role, IP, timestamp | 2 years |
| Admin/infrastructure access | Actor, resource, action, timestamp | 3 years |

**Immutability implementation:** Write to a separate append-only log table or S3 bucket with object lock (WORM). No application process should have DELETE permission on audit log storage. CloudTrail provides infrastructure-level immutability for AWS API calls.

### Penetration testing

**Penetration testing is effectively mandatory before launch.** The 2024 Privacy Act amendments treat regular security testing as a "reasonable step" under APP 11. Practical requirements:

- Pre-launch penetration test by a **CREST-accredited** firm — required by cyber insurers and defensible to regulators
- Scope: web application (patient app + doctor queue), API layer, authentication flows, photo upload pipeline
- Remediate all critical and high findings before launch; medium findings within 30 days
- Annual testing thereafter; ad-hoc testing when significant new features or data flows are added
- Budget: AUD 10,000–25,000 for initial test depending on scope

---

## 3. Medical Photo Storage — Additional Requirements

Photos of wounds, skin conditions, and body areas are particularly sensitive. Beyond standard encryption:

- **Separate S3 bucket** from other patient data, with its own bucket policy
- **Metadata stripping** on upload: EXIF data (which may contain GPS location, device identifiers) must be stripped before storage
- **Signed URLs only**: no public access; photo access via short-lived (15-minute) pre-signed S3 URLs generated on-demand for the reviewing doctor
- **Access tied to consultation assignment**: the IAM policy generating signed URLs must scope to the specific consultation, not all photos for a patient
- **Retention policy**: photos retained for 7 years consistent with medical records, then deleted; automated S3 lifecycle policy

---

## 4. Summary: Minimum Viable Compliance Architecture

The following represents the minimum required before the first patient is onboarded:

### Infrastructure (Sprint 0)

- [ ] AWS RDS ap-southeast-2 with AES-256 encryption enabled at creation (KMS-managed)
- [ ] AWS S3 ap-southeast-2 for photo storage — SSE-KMS, object lock for audit logs, separate bucket per data type
- [ ] VPC with private subnets for database tier; no public exposure of database
- [ ] CloudTrail enabled across all regions; logs shipped to S3 with object lock
- [ ] IAM roles with least-privilege; no long-lived access keys
- [ ] AWS KMS customer-managed keys with automatic rotation
- [ ] Multi-region backup to ap-southeast-4 (Melbourne) for disaster recovery

### Third-party contracts (Pre-Sprint 0)

- [ ] **Execute DPAs** with: Anthropic (or switch to AWS Bedrock), Vapi/Retell.ai, Twilio, SendGrid, Stripe
- [ ] Each DPA must commit the vendor to: APP-compliant handling, data deletion on contract termination, breach notification to Nightingale within 72 hours
- [ ] **Strongly recommended:** Migrate from Anthropic direct API to **AWS Bedrock** before launch — eliminates the most significant cross-border data disclosure risk

### Security controls (Pre-launch)

- [ ] MFA enforced on all doctor and admin accounts (TOTP minimum)
- [ ] TLS 1.3 enforced at load balancer / API gateway
- [ ] RBAC implemented and tested: doctor cannot access another doctor's consultation assignments
- [ ] EXIF stripping on photo upload verified
- [ ] Signed URL access control for photos tested and scoped to consultation level
- [ ] Immutable audit log implemented and tested
- [ ] CREST-accredited penetration test completed; critical/high findings remediated

### Legal (Pre-launch, requires healthcare lawyer)

- [ ] Privacy Policy and Collection Notice — must disclose AI use, third-party processors, and patient rights
- [ ] DPAs reviewed by healthcare lawyer (specialist: Minter Ellison, Gilbert + Tobin, or equivalent)
- [ ] OAIC registration
- [ ] TGA pre-submission advice on SaMD classification obtained

---

## 5. What This Costs

| Item | Estimated Cost (AUD) | Timing |
|------|---------------------|--------|
| Healthcare lawyer — DPAs + Privacy Policy | 5,000–10,000 | Pre-Sprint 0 |
| TGA pre-submission advice + Class IIa documentation | 20,000–50,000 | Pre-launch |
| AWS KMS + CloudTrail + S3 (additional) | ~1,000/year | From Sprint 0 |
| CREST penetration test (pre-launch) | 10,000–25,000 | Pre-launch |
| Cyber insurance (health sector) | 5,000–15,000/year | From launch |
| Annual penetration test (ongoing) | 8,000–15,000/year | Annual |
| **Year 1 compliance total (estimate)** | **~60,000–115,000** | — |

This is consistent with the broader NIGHTINGALE.md Year 1 operating budget and should be treated as a non-discretionary cost of operating in the health sector.

---

## 6. Open Questions Requiring Legal Advice

| Question | Why It Needs a Lawyer |
|----------|----------------------|
| Does Nightingale's anonymisation layer meet the Privacy Act definition of de-identification — or is it pseudonymisation (still personal information)? | Determines whether APP 8 is triggered for Claude API calls at all; material to architecture decisions |
| When a doctor approves a consultation, does that generate a "health record" under state laws that require specific storage or access provisions beyond the Privacy Act? | May affect audit log design and patient access rights |
| Does the NDB scheme require Nightingale to notify patients of a breach at a third-party vendor (e.g., a Twilio breach that exposes SMS content)? | Affects incident response planning |
| Is a DPA with Stripe sufficient for payment data combined with health consultation context, or does this require additional treatment? | Stripe payment data alone is not health information; but combined with consultation timing and amount, context may create sensitivity |

---

## Sources

- [OAIC: Australian Privacy Principles Guidelines — APP 8](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information)
- [OAIC: Notifiable Data Breaches Scheme](https://www.oaic.gov.au/privacy/notifiable-data-breaches/about-the-notifiable-data-breaches-scheme)
- [My Health Records Act 2012 — Federal Register](https://www.legislation.gov.au/Details/C2017C00313)
- [TGA: AI and Medical Device Software Regulation](https://www.tga.gov.au/products/medical-devices/software-and-artificial-intelligence-ai/manufacturing/artificial-intelligence-ai-and-medical-device-software-regulation)
- [ASD Essential Eight](https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight)
- [AWS Security and Compliance — Australia/NZ](https://aws.amazon.com/compliance/australia-new-zealand/)
- [Australian Digital Health Agency — Telehealth Standards](https://www.digitalhealth.gov.au/healthcare-providers/initiatives-and-programs/digital-health-standards)
- [AHPRA: Artificial Intelligence in Healthcare](https://www.ahpra.gov.au/Resources/Artificial-Intelligence-in-healthcare.aspx)
