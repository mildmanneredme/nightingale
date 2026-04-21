# PRD-010 — Photo Upload & Quality Guidance

> **Status:** Not Started
> **Phase:** Sprint 3 (Week 7–8)
> **Type:** Technical — Patient Web App + Storage
> **Owner:** CTO

---

## Overview

Patients can upload 1–5 photos during their consultation to provide visual clinical context (skin conditions, wounds, rashes, visible swelling). The upload flow guides patients toward taking clinically useful photos through real-time quality feedback — framing, lighting, and distance prompts. Photos are stored encrypted in S3 and are accessible only to the doctor assigned to review the consultation.

---

## Background

Photo quality is clinically critical. A blurry or poorly framed photo of a skin lesion is worse than no photo — it can mislead the reviewing doctor. The quality guidance system is designed to help patients without clinical photography training capture useful images.

Photo analysis is handled by the Clinical AI Engine (PRD-012) using Claude Vision. This PRD covers capture, upload, quality check, and storage only.

### Storage Requirements

Medical photos are sensitive health information. Storage must meet:
- AES-256 encryption at rest (SSE-KMS with customer-managed keys)
- No public access — all access via signed URLs only
- EXIF metadata stripped before storage (EXIF can contain GPS coordinates, device info)
- Access scoped to the single assigned doctor during their review window
- 7-year retention in line with health record retention requirements

---

## Functional Requirements

### Upload Trigger

| # | Requirement |
|---|-------------|
| F-001 | Photo upload is offered at the appropriate point in the AI interview, based on the presenting complaint (e.g., always for skin presentations; offered for musculoskeletal on request) |
| F-002 | Patient can skip photo upload if not relevant to their presentation |
| F-003 | Photo upload is available on both desktop (file picker) and mobile (camera or file picker) |
| F-004 | Minimum: 1 photo; maximum: 5 photos per consultation |

### Real-Time Quality Guidance

| # | Requirement |
|---|-------------|
| F-005 | After photo selection, quality is assessed before upload completes |
| F-006 | Quality checks: minimum resolution (>= 1 MP), image not blurry (sharpness threshold), not too dark, not overexposed |
| F-007 | If quality check fails: patient sees specific, actionable guidance (e.g., "Photo is too dark — try in better lighting" or "Photo is blurry — hold your phone steady and retap to focus") |
| F-008 | Patient can retake or reselect a photo if quality check fails |
| F-009 | Patient can override a failed quality warning and upload anyway (with confirmation prompt) |
| F-010 | Doctor is notified in the review dashboard if any photos were uploaded despite failing quality check |
| F-011 | Quality guidance is shown for each photo independently (not a single pass for all) |

### Photo Storage

| # | Requirement |
|---|-------------|
| F-012 | EXIF metadata stripped from all photos before storage |
| F-013 | Photos stored in `nightingale-photos-prod` S3 bucket with SSE-KMS encryption |
| F-014 | Storage key format: `{consultation_id}/{uuid}.jpg` — no patient name or identifying info in path |
| F-015 | Photos are never stored in the application database; only S3 object keys are stored in the database |
| F-016 | Upload progress shown to patient (percentage bar) for files > 2MB |

### Access Control

| # | Requirement |
|---|-------------|
| F-017 | Photo access uses S3 pre-signed URLs with 15-minute expiry |
| F-018 | Pre-signed URLs are only generated for: the assigned doctor (during review), the Clinical AI Engine (during analysis), and admins accessing via audit process |
| F-019 | Patient cannot access their own uploaded photos after upload (photos are clinical records, not personal gallery) |
| F-020 | Photo access events (URL generated, for which actor) logged to audit trail |

---

## Non-Functional Requirements

- **File size:** Maximum 10MB per photo; client-side validation before upload
- **Accepted formats:** JPEG, PNG, HEIC (HEIC converted to JPEG server-side)
- **Upload timeout:** 30-second timeout per photo; retry up to 2 times automatically
- **Mobile camera:** On mobile, must trigger native camera option directly (not just file picker)

---

## Photo Guidance Copy (Initial Set — Medical Director to review)

| Scenario | Guidance Text |
|----------|--------------|
| Skin lesion | "Get within 15–20cm of the area. Make sure the whole lesion is visible with a small border of normal skin around it." |
| Wound | "Clean the area gently before photographing. Include a common object (e.g., a coin) for scale if possible." |
| Rash | "Photograph the worst-affected area and, if possible, a second photo showing the spread pattern." |
| Swelling | "Photograph both the swollen area and the same area on the other side of the body for comparison." |

---

## Acceptance Criteria

- [ ] Patient can upload a photo from mobile camera and from desktop file picker
- [ ] EXIF metadata is stripped before S3 upload (verified by inspecting stored file)
- [ ] Blurry photo (sharpness below threshold) shows retake guidance; sharp photo proceeds
- [ ] Photos stored in S3 with SSE-KMS encryption; no public access (verified by attempting direct URL access)
- [ ] Pre-signed URL expires after 15 minutes (verified by attempting access after 16 minutes)
- [ ] Doctor can access photos via pre-signed URL in review dashboard
- [ ] Patient cannot access photos after upload (verified by attempting access from patient session)
- [ ] Photo access events appear in audit log
- [ ] HEIC photos from iPhone are converted to JPEG and stored successfully

---

## Dependencies

- PRD-003: S3 bucket provisioned with correct encryption and access controls
- PRD-005: Audit log captures photo access events
- PRD-008 / PRD-009: Photo upload prompt triggered by voice/text interview flow

---

## Out of Scope

- AI-guided framing overlay in camera view (like a target reticle — Phase 2)
- Video upload
- Patient photo library management (patients cannot browse their uploaded photos)
