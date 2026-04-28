# PRD-026 — Photo AI Vision Analysis

> **Status:** Not started
> **Phase:** Build — pre-beta (clinical quality gate)
> **Type:** Technical — AI / Clinical
> **Priority:** P1 — pre-beta. Skin conditions are one of the five MVP presentations; without photo analysis the AI's SOAP note and differential for image-dependent presentations are systematically incomplete.
> **Owner:** CTO + Medical Director
> **Depends on:** PRD-010 (Photo Upload — S3 pipeline already ships EXIF-stripped images), PRD-012 (Clinical AI Engine — this PRD extends it)

---

## Overview

Photos are uploaded by patients during consultations (PRD-010) and displayed to doctors in the review queue (PRD-013), but the clinical AI engine (PRD-012) currently generates SOAP notes, differentials, and draft responses from the transcript alone. Photo content is never passed to Claude — the AI is clinically blind to uploaded images.

This PRD extends the clinical AI engine pipeline to pass consultation photos to Claude Vision as part of the same inference call that produces the SOAP note and differential. The doctor receives an AI assessment that has actually analysed the visual evidence, not one that ignores it.

---

## Background

### Current state

`clinicalAiEngine.ts` fetches photos only to count rows where `quality_overridden = true` — a number used to set the `POOR_PHOTO` priority flag. The actual image content is never retrieved or forwarded. The user message sent to Claude contains only the anonymised transcript and patient context (plain text).

PRD-012 explicitly deferred photo vision analysis pending Medical Director sign-off on image analysis prompts. That sign-off is now the primary gate for this work.

### Why this matters clinically

Three of the five MVP presentations have a photo-dependent diagnostic component:

| Presentation | Photo relevance |
|-------------|----------------|
| Skin conditions (rash, wound, lesion) | Visual morphology is the primary diagnostic data point — transcript alone is insufficient |
| Musculoskeletal pain | Photos of swelling, deformity, bruising can change the differential |
| URTI / UTI | Low photo relevance — transcript usually sufficient |

Without photo analysis, the AI draft for a skin condition is based entirely on the patient's verbal description. Doctors must bridge the gap manually between what the AI says and what they see in the photos — increasing amendment rate and review time.

### Claude Vision via AWS Bedrock

Claude Sonnet 4.6 on AWS Bedrock ap-southeast-2 supports multimodal messages (image blocks alongside text). Images can be passed as base64-encoded content in the `content` array of the user message. All inference stays in-region (ap-southeast-2) — no new data residency implications.

Image size limit per block: 5 MB. Consultation photos are already resized and quality-checked at upload (PRD-010 — max 10 MB raw, client-side compressed). Pre-flight size check required before passing to Claude.

---

## User Roles & Access

| Actor | Interaction |
|-------|------------|
| Patient | Indirect — uploaded photos become vision inputs to the engine |
| Doctor | Receives AI assessment that incorporates visual analysis; photo findings referenced in SOAP note |
| Medical Director | Reviews and approves updated system prompt (image analysis instructions) before production deployment |
| System | Engine fetches photos from S3, base64-encodes, and includes in Claude message |

---

## Functional Requirements

### Image Retrieval

| # | Requirement |
|---|-------------|
| F-001 | Engine fetches all accepted photos for the consultation from S3 using short-lived presigned URLs (reuse existing photo service pattern from PRD-010) |
| F-002 | Photos are downloaded in the engine process and base64-encoded in memory; presigned URLs are not forwarded to Claude (base64 inline only — avoids Claude making outbound requests to S3) |
| F-003 | If no photos are attached to the consultation, the engine runs as today (text-only) with no change in behaviour |
| F-004 | If a photo download fails (S3 error, expired URL), the engine logs a warning and proceeds text-only rather than aborting; the POOR_PHOTO flag is set |
| F-005 | Maximum 5 photos per consultation (enforced at upload — PRD-010); engine passes all accepted photos |
| F-006 | Pre-flight check: skip any individual photo exceeding 4 MB post-encoding to avoid Bedrock payload limits; log skipped photos to audit trail |

### Prompt Integration

| # | Requirement |
|---|-------------|
| F-007 | System prompt extended with Medical Director–approved photo analysis instructions: what to assess (morphology, distribution, colour, margins), AHPRA language constraints (e.g., "may be consistent with" not "this is") |
| F-008 | Photo blocks are placed in the user message content array after the transcript text, labelled by index (e.g., "Photo 1 of 3:") |
| F-009 | SOAP Objective section explicitly references photo findings when photos are present; if photos are absent, Objective notes "No photos provided" |
| F-010 | Differential diagnosis incorporates visual evidence when present; each differential item may include a note on supporting visual features |
| F-011 | If all photos are `quality_overridden = true` (doctor overrode low-quality flag), the system prompt includes a note that image quality may be limited |
| F-012 | Engine output includes a boolean `photosAnalysed` flag written to the consultation record and surfaced in the doctor queue |

### Doctor Queue Display

| # | Requirement |
|---|-------------|
| F-013 | Doctor review ticket shows a "Photos analysed by AI" badge when `photosAnalysed = true`; shows "Photos not analysed" when false (no photos, or download failure) |

### PII & Privacy

| # | Requirement |
|---|-------------|
| F-014 | EXIF data is already stripped at upload time (PRD-010 — `sharp` library); no additional EXIF handling required in this PRD |
| F-015 | Photos are passed to Claude via AWS Bedrock ap-southeast-2 only — same data residency boundary as the existing text inference |
| F-016 | Photo content is not logged or stored beyond what already exists in S3; base64 encoding is in-memory only |

---

## Non-Functional Requirements

- **Latency:** Adding up to 5 images will increase token count and inference time. Target: SOAP generation still completes within 60 seconds (PRD-012 target was 30s text-only; 60s is acceptable for photo-augmented calls). Measure p95 in staging.
- **Cost:** Image tokens are billed at the same rate as text tokens on Bedrock. Estimate ~1,000–2,500 additional tokens per photo (depending on resolution post-encoding). For 3 photos, this adds ~$0.01–0.05 AUD per consultation — within the $2 target.
- **Medical Director sign-off:** Updated system prompt (photo analysis instructions) must be approved by Medical Director before production deployment. This is a hard gate.

---

## Compliance Notes

**AWS Bedrock data residency:** Image content sent to Claude via Bedrock ap-southeast-2 stays in-region. No new APP 8 cross-border disclosure triggered.

**AHPRA language:** Photo analysis outputs must follow the same constrained language as transcript-based outputs. The system prompt extension must be reviewed by the AHPRA advertising compliance reviewer as part of the pre-production sign-off (PREREQ-001).

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `engine.photos_analysed` | Photos included in Claude call; includes count and consultation_id |
| `engine.photo_skipped` | Individual photo skipped due to size limit or download failure |
| `engine.photos_none` | No photos attached; engine ran text-only |

---

## Acceptance Criteria

- [ ] Skin condition consultation with 2 uploaded photos: SOAP Objective references visual findings
- [ ] Consultation with no photos: engine runs text-only; `photosAnalysed = false` in DB
- [ ] S3 download failure for one photo: engine continues with remaining photos; warning logged; does not abort
- [ ] Photos exceeding 4 MB: skipped with audit log entry; engine continues
- [ ] Doctor queue shows "Photos analysed by AI" badge correctly
- [ ] `photosAnalysed` flag written to consultation record
- [ ] No PII (patient name, Medicare number) appears in the image retrieval or Claude call logs
- [ ] Medical Director has reviewed and approved updated system prompt
- [ ] Inference p95 latency ≤ 60 seconds in staging with 3-photo consultation

---

## Dependencies

- PRD-010: Photo upload pipeline (S3 storage, EXIF stripping, quality flags) — already shipped
- PRD-012: Clinical AI engine — this PRD extends the engine; must not break existing text-only path
- PRD-013: Doctor review dashboard — `photosAnalysed` badge addition
- PREREQ-001: Medical Director and AHPRA compliance sign-off on photo analysis system prompt

---

## Out of Scope

- Standalone photo triage endpoint (photos analysed before consultation is complete)
- Real-time photo feedback during upload (quality guidance already handled in PRD-010)
- Dermatology-specific fine-tuning or specialised vision models
- Photo-only consultations (no transcript)
