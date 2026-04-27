# BUG-007 — Remove Placeholder & Fake Content from Patient Surfaces

**Type:** Bug fix bundle
**Status:** Not Started
**Priority:** P0 — credibility / regulatory risk; fix before any real patient onboards
**Sprint:** TBD
**Scope:** Frontend only

---

## Problem Summary

Several patient-facing surfaces ship hardcoded placeholder values that look like real data. For a regulated health product these create three problems:

1. **AHPRA / advertising-compliance risk** — testimonial-like statistics that imply a patient base and quality outcomes that do not yet exist.
2. **Clinical-trust risk** — fabricated personal "vitals" lead patients to believe the system is integrated with health-tracking sources that it is not.
3. **Onboarding-trust risk** — "85% Complete" profile widget and "Personal details ✓" tile shown on a brand-new account where no profile data has been collected.

Two functional bugs in the same area:

4. Privacy / Collection-Notice links on the register page point to `/legal/privacy` and `/legal/collection-notice`, which do not exist (PRD-022 ships them at `/privacy` and `/disclaimer`).

---

## Root Causes

| # | Issue | File / Line | Root Cause |
|---|-------|-------------|------------|
| 1 | "15k+ Active Patients", "4.9/5 Average Rating", "100% AHPRA Registered", "< 5m Response Time" trust band on landing | `web/src/app/(marketing)/page.tsx` line ~58–73 | Hardcoded array, no data source |
| 2 | "Vitals Snapshot" tile on dashboard shows fake heart rate (72 bpm), sleep (7.5 hrs), and "Last sync: 2 hours ago" | `web/src/app/(patient)/dashboard/page.tsx` line ~239–259 | Hardcoded JSX; no vitals integration exists |
| 3 | "Health Profile — 85% Complete" with hardcoded progress bar | `web/src/app/(patient)/dashboard/page.tsx` line ~107–138 | Hardcoded `w-[85%]` and "85% Complete" string |
| 4 | "Personal details ✓" tile shows green check on a fresh account | `web/src/app/(patient)/dashboard/page.tsx` line ~121–128 | Hardcoded `check_circle` icon, never inspects profile |
| 5 | Privacy / Collection-Notice links 404 from register form | `web/src/app/(auth)/register/page.tsx` line ~193, 195 | Hrefs `/legal/privacy` and `/legal/collection-notice` predate the marketing site routes |

---

## Requirements

### F-001 — Remove fake landing trust band

Delete the four-tile stats band ("15k+ Active Patients", etc.) from `(marketing)/page.tsx`. Replace with either:
- Nothing (preferred — cleaner hero), or
- Trust signals that are factually true today: "AHPRA-registered doctors", "Australian-owned and hosted", "End-to-end encrypted" — qualitative, no numerical claims.

No numbers may be displayed unless wired to a real metric source.

### F-002 — Remove fake vitals snapshot from dashboard

Delete the "Vitals Snapshot" tile entirely. The product does not currently integrate with Apple Health / wearables (per ROADMAP "Out of Scope"). Reintroducing this tile is a Phase 2 PRD.

### F-003 — Replace hardcoded profile completeness widget

Either:
- (a) Remove the "Health Profile — 85% Complete" tile entirely, **or**
- (b) Block this BUG behind PRD-023 which wires up a real completeness calculation.

For this BUG, option (a) is the minimum: remove the tile so the dashboard does not lie to the user. PRD-023 will reintroduce a properly-computed version.

### F-004 — Fix broken legal links in register form

Update register-form hrefs:
- `/legal/privacy` → `/privacy`
- `/legal/collection-notice` → `/disclaimer` (or a new `/collection-notice` page if Privacy and Collection-Notice need to be distinct documents — confirm with PRD-022 author)

Footer link "Legal" on the register form (`href="/legal/privacy"` line ~260) should also be updated.

---

## Out of Scope

- Reinstating any of these tiles with real data — that is PRD-023 (profile completeness) or future Phase 2 PRDs (vitals integration).
- Re-pricing copy / fee messaging consistency — that is UX-005.

---

## Acceptance Criteria

- [ ] Landing page contains no numerical stats that are not sourced from real data.
- [ ] Dashboard contains no "Vitals Snapshot" tile.
- [ ] Dashboard does not display a hardcoded profile completeness percentage.
- [ ] Register form Privacy / Collection-Notice links resolve to live pages (no 404).
- [ ] Register form "Legal" footer link resolves to a live page.
- [ ] Vitest suite passes.
- [ ] Manual smoke: brand-new account → dashboard shows no false-positive "complete" indicators.
