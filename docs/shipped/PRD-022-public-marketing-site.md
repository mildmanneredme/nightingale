# PRD-022: Public Marketing Site

**Status:** In Progress
**Priority:** P0 — Required for public launch
**Resolves:** BUG-002 (missing legal pages)

## Problem

Nightingale has a fully functional authenticated patient/doctor portal but no public-facing presence. Without a landing page and supporting pages, there is no way for prospective patients or doctor partners to discover or evaluate the service.

## Goal

Build a public marketing site — living at the root `/` of the Next.js app, unauthenticated — that:

1. Converts first-time visitors into registered patients
2. Recruits AHPRA-registered GPs as doctor partners
3. Satisfies AHPRA advertising compliance requirements
4. Provides legally required Privacy Policy, Terms of Service, and Medical Disclaimer (resolves BUG-002)

## Pages

| Route | Page | Audience | Priority |
|---|---|---|---|
| `/` | Home | Patients, Doctors | P0 |
| `/how-it-works` | How It Works | Patients | P0 |
| `/pricing` | Pricing | Patients | P0 |
| `/safety` | Safety & Trust | Patients, Regulators | P0 |
| `/faq` | FAQ | Patients | P0 |
| `/for-doctors` | For Doctors | GP Partners | P1 |
| `/about` | About | All | P1 |
| `/privacy` | Privacy Policy | Legal/Compliance | P0 |
| `/terms` | Terms of Service | Legal/Compliance | P0 |
| `/disclaimer` | Medical Disclaimer | Legal/Compliance | P0 |

## Architecture

All marketing pages live under a `(marketing)` Next.js route group at `web/src/app/(marketing)/`. This group:
- Requires no authentication
- Renders `MarketingNav` + `MarketingFooter` instead of the app's authenticated nav bars
- Does NOT include auth redirect logic

## AHPRA Compliance

All copy must use "assess" not "diagnose", "recommend" not "prescribe". Emergency callout (000) on Home, Safety, Disclaimer, and footer. Legal pages require lawyer review before public launch.

## Acceptance Criteria

- [ ] All 10 pages render on mobile (375px) and desktop (1280px)
- [ ] Unauthenticated access to all marketing routes (no redirects)
- [ ] Emergency 000 callout visible on Home, Safety, Disclaimer, and footer
- [ ] CTAs route to `/register` (patients) or doctor interest form
- [ ] Legal pages live at `/privacy`, `/terms`, `/disclaimer`
- [ ] `npm run build` passes with no TypeScript errors
