# BUG-002 — Legal Pages: Privacy Policy & Collection Notice

**Type:** Bug fix + content creation  
**Status:** Shipped 2026-04-25 — resolved via PRD-022 public marketing site. Privacy at `/privacy`, Terms at `/terms`, Disclaimer at `/disclaimer`.  
**Priority:** High — linked from the registration flow; broken links block signup trust signal  
**Sprint:** Sprint 8  
**Scope:** Frontend + legal content

---

## Problem Summary

The registration form links to `/legal/privacy` and `/legal/collection-notice`, but neither page exists. Both return 404. This means:

1. Patients cannot read the documents they are being asked to consent to — a consent checkbox without accessible terms is not valid informed consent.
2. Both URLs are linked in a legal compliance checkpoint (`privacyAccepted` checkbox) on the registration page, making this a regulatory gap, not just a UX bug.

---

## Root Cause

The `legal/` directory was never created. Neither `web/src/app/legal/privacy/page.tsx` nor `web/src/app/legal/collection-notice/page.tsx` exist.

---

## Requirements

### F-001 — Privacy Policy page at `/legal/privacy`

Must include at minimum (Australian Privacy Act 1988 + APP requirements):

- Who we are (Nightingale Health Pty Ltd, ABN TBD)
- What personal information we collect (name, DOB, contact details, health information)
- How we collect it (directly from patients, from consultations)
- Why we collect it (to provide telehealth services, doctor review, billing)
- Who we disclose it to (contracted doctors, SendGrid for email, AWS for hosting, Stripe for payments)
- How we store and protect it (AWS ap-southeast-2, encrypted at rest, access controls)
- How long we retain it (health records: 7 years minimum per state law)
- Patient rights (access, correction, complaints to OAIC)
- Contact for privacy enquiries

### F-002 — Collection Notice page at `/legal/collection-notice`

A shorter, point-of-collection notice (required at or before the time of collection under APP 5):

- The organisation collecting the information
- The purposes of collection
- Any third parties the information may be disclosed to
- Whether collection is required by law or voluntary
- How to access and correct the information
- Link to full Privacy Policy

### F-003 — Shared legal page layout

Both pages should share a clean, readable layout:
- No auth required (public pages, no layout guard)
- No nav bar / app chrome — standalone page
- Nightingale wordmark at top, back link to `/register`
- Last updated date shown prominently
- Print-friendly

---

## Content Owner

**Robert Xie** must supply or approve the legal text before implementation. The engineering work (page scaffolding, layout, routing) can be done in parallel, with placeholder content replaced before the pages go live.

A legal professional familiar with Australian health privacy law (Privacy Act 1988, Health Records Act) should review before launch.

---

## Out of Scope

- Terms of Service page (separate document, not currently linked)
- Cookie policy
- Any backend changes

---

## Acceptance Criteria

- [ ] `/legal/privacy` returns 200 with readable privacy policy content
- [ ] `/legal/collection-notice` returns 200 with readable collection notice content
- [ ] Both pages are accessible without authentication
- [ ] Both pages link back to `/register`
- [ ] The `privacyAccepted` checkbox on `/register` links correctly to both pages
- [ ] Content has been reviewed and approved before going live
- [ ] "Last updated" date is displayed on both pages
