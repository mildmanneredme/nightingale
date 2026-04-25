# PRD-016 — UI Redesign: Implement Stitch Mockups

**Type:** Feature  
**Status:** Shipped 2026-04-25 — DS-001/DS-002 (Manrope + Public Sans + Material Symbols fonts, Tailwind aliases); SC-001–SC-004 (TopAppBar, BottomNavBar, DoctorSideNav, StatusBadge, ConsultationStepper, Toast); full page rewrites for login, register, dashboard, consultation flows, doctor portal, admin portal.  
**Priority:** High — current UI does not match approved designs; staging looks unpolished  
**Sprint:** Sprint 8  
**Scope:** Frontend only — `web/` directory  
**Source designs:** `stitch_nightingale_telehealth_interface/*/code.html`

---

## Background

All screens have been designed in Stitch and exported as HTML mockups. The current Next.js app has the correct Tailwind design tokens (colors, spacing, typography) and the correct page routing, but every page's visual layout does not match the mockups. This PRD specifies exactly what to build to close that gap.

The mockup HTML files are the source of truth for all visual decisions. Where this PRD describes a pattern, read it alongside the corresponding `code.html`.

---

## Design System

The design system is already wired into `web/tailwind.config.ts`. The following gaps must be closed first (blocking every page):

### DS-001 — Load Google Fonts in layout

`web/src/app/layout.tsx` must load:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
```

Also add global styles to `globals.css`:

```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
body {
  font-family: 'Public Sans', sans-serif;
  background-color: #faf9fd;
}
```

### DS-002 — Tailwind font family aliases

Add these aliases to `tailwind.config.ts` under `fontFamily` so mockup class names work directly:

```ts
"manrope": ["Manrope", "sans-serif"],
"display-xl": ["Manrope", "sans-serif"],
"headline-lg": ["Manrope", "sans-serif"],
"headline-md": ["Manrope", "sans-serif"],
"body-md": ["Public Sans", "sans-serif"],
"body-lg": ["Public Sans", "sans-serif"],
"clinical-data": ["Public Sans", "sans-serif"],
"label-sm": ["Public Sans", "sans-serif"],
```

---

## Shared Components

These components are referenced across multiple pages and must be built before page rewrites begin.

### SC-001 — `TopAppBar` (patient)

**File:** `web/src/components/TopAppBar.tsx`  
**Reference:** `patient_dashboard/code.html` → `<header>`

Props:
- `activeNav?: "health" | "appointments" | "records"` — underlines the active nav item

Structure:
- Fixed, `z-50`, white/90 with `backdrop-blur-md`, bottom border, `h-16`
- Left: "Nightingale" wordmark (`font-manrope font-bold tracking-tighter text-primary text-xl`)
- Center (hidden on mobile): nav links "My Health", "Appointments", "Records" — active link gets `border-b-2 border-primary`
- Right: notifications icon button, help icon button, avatar circle (`w-8 h-8 rounded-full`)
- All icons use `<span className="material-symbols-outlined">`

### SC-002 — `BottomNavBar` (patient mobile)

**File:** `web/src/components/BottomNavBar.tsx`  
**Reference:** `patient_dashboard/code.html` → `<nav>` at bottom

Props:
- `active: "home" | "health" | "history" | "profile"`

Structure:
- Fixed bottom, `md:hidden`, white, top border, `rounded-t-2xl`, `shadow-[0_-4px_12px_rgba(0,0,0,0.05)]`
- 4 items: Home (`home`), Health (`medical_information`), History (`history`), Profile (`person`)
- Active item: `text-primary bg-blue-50 rounded-xl px-4 py-1`
- Inactive: `text-slate-400`
- Each item: icon + label text `text-[10px] font-bold uppercase tracking-widest`

### SC-003 — `DoctorSideNav`

**File:** `web/src/components/DoctorSideNav.tsx`  
**Reference:** `doctor_queue/code.html` → `<aside>`

Props:
- `active: "hub" | "queue" | "schedule" | "analytics" | "settings"`
- `doctorName: string`

Structure:
- `hidden md:flex flex-col h-screen w-64 border-r sticky left-0 top-0 bg-slate-50`
- Top: "Nightingale" wordmark + doctor avatar + name + role subtitle
- Nav items with `.sidebar-active` (bg-primary, white text) and `.sidebar-inactive` (hover slide right) styles
  - Clinical Hub (`dashboard`)
  - Patient Queue (`group`)
  - Schedule (`calendar_month`)
  - Analytics (`monitoring`)
  - Settings (`settings`)
- Bottom: teal "Start Consultation" button

### SC-004 — `StatusBadge`

**File:** `web/src/components/StatusBadge.tsx`  
**Reference:** `patient_dashboard/code.html` → table status cells

Props:
- `status: string`

Renders a pill (`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider`) with these mappings:

| Status | bg | text |
|---|---|---|
| `approved` / `amended` | `bg-secondary-container` | `text-on-secondary-container` |
| `pending` / `queued_for_review` / `transcript_ready` | `bg-tertiary-fixed` | `text-on-tertiary-fixed-variant` |
| `rejected` / `emergency_escalated` / `cannot_assess` | `bg-error-container` | `text-on-error-container` |
| `active` | `bg-secondary-container` | `text-on-secondary-container` |
| `resolved` | `bg-surface-container` | `text-on-surface-variant` |
| default | `bg-surface-container` | `text-on-surface-variant` |

---

## Page Rewrites

All page rewrites must preserve existing logic (API calls, state, routing). Only the JSX/HTML structure and Tailwind classes change. TypeScript types and hooks are unchanged.

### P-001 — `/login` (Auth — Login)

**File:** `web/src/app/(auth)/login/page.tsx`  
**Reference:** `patient_register/code.html` — same layout, different form content

Layout: two-column split (`md:flex-row`):
- **Left panel** (`hidden md:flex md:w-5/12 bg-primary-container`):
  - Dot-grid background pattern (`bg-medical-pattern`)
  - "Nightingale" display wordmark
  - Headline: "Your health journey, unified and secure."
  - Body copy about Australian healthcare
  - Two trust badges: "Australian Privacy Act Compliant" (`verified_user` icon) and "End-to-End Clinical Encryption" (`encrypted` icon)
- **Right panel** (`flex-1 flex items-center justify-center bg-surface-bright`):
  - Mobile wordmark (visible only on mobile)
  - Heading: "Welcome back"
  - Subtext with "Don't have an account? Register here" link
  - Email field with `mail` icon prefix
  - Password field with `lock` icon prefix + visibility toggle (`visibility` / `visibility_off`)
  - **"Forgot password?" link** below password field → `/forgot-password`
  - Primary CTA button: "Sign In" (`bg-primary text-white`)
  - Support footer: Australian flag + "Proudly Australian Owned" + Support / Legal links

Error display: existing `error` state shown as `bg-error-container text-on-error-container` alert banner above form.

### P-002 — `/register` (Auth — Register)

**File:** `web/src/app/(auth)/register/page.tsx`  
**Reference:** `patient_register/code.html`

Same two-column layout as login. Right panel form:
- Step 1 (register): Email + Password inputs + privacy checkbox + "Create Account" CTA
- Step 2 (verify): Verification code input + "Verify Account" CTA

Privacy checkbox must link to `/legal/privacy` and `/legal/collection-notice` (matching existing href targets in the page).

All existing logic (multi-step state, signUp/confirmSignUp calls, error handling) preserved.

### P-003 — `/dashboard` (Patient Dashboard)

**File:** `web/src/app/(patient)/dashboard/page.tsx`  
**Reference:** `patient_dashboard/code.html`

Wrap with `<TopAppBar activeNav="health" />` and `<BottomNavBar active="home" />`.

Layout: `<main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-7xl mx-auto">`

Sections:
1. **Welcome section**: "Good morning, {name}" (`font-headline-lg text-primary`) + subtitle
2. **Bento grid** (`grid grid-cols-12 gap-gutter`):
   - **CTA Card** (`col-span-12 lg:col-span-8 bg-primary rounded-xl p-8`): "Need medical advice?" headline, body copy, teal "Start New Consultation" button with `add_circle` filled icon
   - **Profile Completeness** (`col-span-12 lg:col-span-4 bg-white rounded-xl`): Progress bar, check/pending items
   - **Consultation History table** (`col-span-12 bg-white rounded-xl`): table with Date, Complaint, Doctor, Status columns. Use `<StatusBadge>` for status column. Show "View All" button.
   - **Vitals Snapshot** (`col-span-12 md:col-span-6 bg-white rounded-xl`): Heart rate + Sleep metrics in 2-col grid
   - **Telehealth Tip** (`col-span-12 md:col-span-6 bg-secondary-container/20 rounded-xl`): Tip copy + decorative videocam icon

The consultation history table replaces the current card list. Map the existing `consultations` state to table rows: date (`createdAt`), complaint (`presentingComplaint`), doctor (show "—" if not assigned), status (`<StatusBadge>`). PDF download moves into a row action (small icon button at right).

FAB: `fixed bottom-24 right-6 md:bottom-8 md:right-8 bg-primary w-14 h-14 rounded-full md:hidden` with `add` icon, links to `/consultation/new`.

### P-004 — `/consultation/new` (New Consultation)

**File:** `web/src/app/(patient)/consultation/new/page.tsx`  
**Reference:** `patient_new_consultation/code.html`

Wrap with `<TopAppBar activeNav="appointments" />` and `<BottomNavBar active="health" />`.

Layout: `<main className="pt-24 pb-32 px-6 md:px-[32px] max-w-4xl mx-auto">`

Sections:
1. **Progress stepper**: 3 steps — Description (active, teal), Provider (outline), Payment (outline). Connected by `h-[2px] bg-outline-variant` dividers.
2. **Bento grid** (`grid grid-cols-1 md:grid-cols-12 gap-gutter`):
   - **Main Input Card** (`md:col-span-8`): "What brings you in today?" label, textarea (max 200 chars) with char counter bottom-right, info banner below
   - **Mode Selection** (`md:col-span-4`): Voice Call (active, teal border + check icon) and Text Chat options as selectable cards
   - **Fee Summary** (`md:col-span-4`): dark navy card, "$50.00 AUD" display, refund guarantee note
3. **Action area**: doctor avatars stack + wait time text on left; "Continue to Payment" button on right
4. **Clinical Safety Guarantee** card at bottom

All existing logic (consultationType state, form submission, API call) preserved.

### P-005 — `/consultation/[id]/voice` (Voice Consultation)

**File:** `web/src/app/(patient)/consultation/[id]/voice/page.tsx`  
**Reference:** `patient_voice_consultation/code.html`

Wrap with `<TopAppBar />`. Full-screen dark (`bg-[#0D1F3C]`) consultation UI:
- Animated audio waveform (CSS animation, teal pulses)
- "Connected to AI Clinical Assistant" status + live timer
- Transcript panel (scrollable, right side on desktop)
- Bottom controls: mute, end call, expand transcript

### P-006 — `/consultation/[id]/text` (Text Consultation)

**File:** `web/src/app/(patient)/consultation/[id]/text/page.tsx`  
**Reference:** `patient_text_consultation/code.html`

Wrap with `<TopAppBar />`. Chat-style UI:
- Message bubbles: patient = right/primary, AI = left/surface-container
- Input bar fixed at bottom with send button
- "Doctor Review Pending" status indicator at top

### P-007 — `/consultation/[id]/audio-check` (Audio Check)

**File:** `web/src/app/(patient)/consultation/[id]/audio-check/page.tsx`  
**Reference:** `patient_audio_check/code.html`

Centered page with:
- Microphone permission check UI
- Animated mic level indicator (CSS)
- "Test passed" / "No signal" status
- "Continue to Consultation" CTA

### P-008 — `/consultation/[id]/photos` (Photo Upload)

**File:** `web/src/app/(patient)/consultation/[id]/photos/page.tsx`  
**Reference:** `patient_photo_upload/code.html`

- Upload zone: dashed border card with camera icon, drag-and-drop or tap to select
- Photo preview grid (thumbnail with remove button)
- Photo tips panel (lighting, angle, distance)
- "Submit Photos" CTA

### P-009 — `/consultation/[id]/result` (Consultation Result)

**File:** `web/src/app/(patient)/consultation/[id]/result/page.tsx`  
**Reference:** `patient_consultation_result_approved/code.html` and `patient_consultation_result_rejected/code.html`

Layout varies based on `status`:

**Approved** (`status === "approved" || "amended"`):
- Green/teal hero banner: large `check_circle` icon, "Your consultation has been approved", doctor name
- Prescription/advice section: formatted text block
- PDF download CTA: `bg-primary` button with `download` icon
- "Return to Dashboard" link

**Rejected** (`status === "rejected"`):
- Error-toned hero: `cancel` icon, "Unable to assess remotely"
- Doctor notes
- "Find a clinic near you" CTA
- "Return to Dashboard" link

**Pending** (awaiting review):
- Neutral/teal progress state: `hourglass_top` animated icon, "Under review"
- Estimated review time
- Auto-refresh (poll every 30s)

### P-010 — `/history` (Medical History)

**File:** `web/src/app/(patient)/history/page.tsx`  
**Reference:** `patient_medical_history/code.html`

Wrap with `<TopAppBar activeNav="records" />` and `<BottomNavBar active="history" />`.

- Timeline of past consultations grouped by month
- Each row: date, complaint, doctor, status badge, "View" link
- Filter chips: All / Approved / Pending / Rejected

### P-011 — `/profile` (Profile Edit)

**File:** `web/src/app/(patient)/profile/page.tsx`  
**Reference:** `patient_profile_edit/code.html`

Wrap with `<TopAppBar />` and `<BottomNavBar active="profile" />`.

Sections:
- Avatar + name header
- Personal details form (name, DOB, phone, Medicare)
- "Save changes" CTA
- "Sign out" link at bottom

### P-012 — `/doctor/queue` (Doctor Queue)

**File:** `web/src/app/(doctor)/doctor/queue/page.tsx`  
**Reference:** `doctor_queue/code.html`

Layout: `flex` row — `<DoctorSideNav active="queue" />` + main content.

Header: "Pending Consultations ({count})" + filter pills (ALL / VOICE / TEXT) + "Filter by Flag" button.

Queue grid (`grid grid-cols-1 xl:grid-cols-2 gap-4`):

Each card (`bg-white rounded-xl p-4 shadow-sm`):
- Flagged items: `border-2 border-tertiary-fixed-dim` + left color strip `w-1 h-full bg-tertiary-fixed-dim`
- Normal items: `border border-slate-200`
- Patient: avatar placeholder + age/gender + `#NH-XXXX` ID
- Type badge: Voice (`bg-blue-50 text-blue-900`) or Text (`bg-emerald-50 text-emerald-800`)
- Complaint text (2-line clamp)
- Flag chips: POOR PHOTO, LOW CONFIDENCE (amber), PEDIATRIC (red), ROUTINE (gray), CHRONIC CARE (teal)
- Footer: time ago + photo count + "Open" button (`bg-primary text-white px-6 py-2 rounded-lg`)

### P-013 — `/doctor/consultation/[id]` (Consultation Review)

**File:** `web/src/app/(doctor)/doctor/consultation/[id]/page.tsx`  
**Reference:** `doctor_consultation_review/code.html`

Layout: `<DoctorSideNav active="queue" />` + two-column main:
- **Left panel**: Patient summary (age, gender, ID), complaint text, AI transcript/summary, photo gallery thumbnails
- **Right panel**: Response composer with AI-suggested response (editable textarea), action buttons: "Approve & Send" (`bg-secondary`) and "Reject" (`bg-error-container text-on-error-container`)
- Clinical flags displayed as chips below patient info
- "Request Amend" links to `/doctor/consultation/[id]/amend`

### P-014 — `/doctor/consultation/[id]/amend` (Amend Response)

**File:** `web/src/app/(doctor)/doctor/consultation/[id]/amend/page.tsx`  
**Reference:** `doctor_amend_response/code.html`

Layout: `<DoctorSideNav active="queue" />` + centered form:
- Original AI response shown in a read-only panel (`bg-surface-container rounded-xl`)
- Amended response textarea (editable, pre-filled with original)
- Amendment reason dropdown or text field
- "Submit Amendment" CTA

---

## Implementation Notes

### What is NOT changing

- All TypeScript types, API functions, Cognito auth logic
- Routing structure and Next.js route groups
- `tailwind.config.ts` color tokens (already correct)
- Auth guard (`useAuth` hooks in layouts)

### Approach

1. Build shared components (SC-001 through SC-004) first — they unblock all page rewrites
2. Fix DS-001/DS-002 (fonts + Tailwind aliases) — these are one-line changes, do first
3. Pages in priority order: Login/Register → Dashboard → Doctor Queue → Doctor Consultation Review → remaining patient pages
4. Preserve all existing functional logic; only replace JSX structure

### Font family class naming

The mockups use `font-manrope` directly as an inline class. The Tailwind config must map `manrope` → `["Manrope", "sans-serif"]` so `font-manrope` resolves. All headline elements use Manrope; all body/label/clinical-data use Public Sans.

### Material Symbols usage

```tsx
<span className="material-symbols-outlined">icon_name</span>
```

For filled variant, add inline style:
```tsx
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>icon_name</span>
```

---

## Acceptance Criteria

- [ ] Google Fonts (Manrope + Public Sans + Material Symbols) load on all pages
- [ ] `/login` matches the two-column split layout from `patient_register/code.html`
- [ ] `/register` matches the two-column split layout with two-step form
- [ ] `/dashboard` renders the bento grid with CTA card, consultation table, vitals, and tip card
- [ ] `/consultation/new` renders the stepper, textarea/mode/fee bento, and action area
- [ ] `/doctor/queue` renders the sidebar + flagged/normal consultation cards
- [ ] `/doctor/consultation/[id]` renders the two-column review layout
- [ ] All patient pages include TopAppBar + BottomNavBar
- [ ] All doctor pages include DoctorSideNav
- [ ] StatusBadge used consistently across dashboard and doctor queue
- [ ] All existing API calls and auth logic continue to function
- [ ] TypeScript check (`npm run build`) passes
- [ ] Responsive: mobile layouts correct on 375px viewport, desktop on 1280px

---

## Out of Scope

- Dark mode (mockups are light-only)
- Animation/transitions beyond what's in the mockup CSS
- Any backend changes
- BUG-001, BUG-002, BUG-003 (tracked separately)

---

## Sprint Breakdown

| Sprint | Items |
|---|---|
| Sprint 1 | DS-001, DS-002, SC-001 through SC-004, P-001 (Login), P-002 (Register) |
| Sprint 2 | P-003 (Dashboard), P-012 (Doctor Queue), P-013 (Doctor Review) |
| Sprint 3 | P-004 (New Consultation), P-009 (Result), P-014 (Amend) |
| Sprint 4 | P-005 through P-008 (consultation flow pages), P-010, P-011 |
