# PRD-017 — Doctor Scheduling & Availability

> **Status:** Not Started
> **Phase:** Sprint 5 (Week 10–12)
> **Type:** Technical — Doctor Web App
> **Owner:** CTO

---

## Overview

Doctors need to set and manage their available hours so the platform can accept consultation bookings only when a GP is available to review them. The design shows a "Schedule" nav item in the doctor portal and a "Monthly Capacity Reached — 82%" widget with an "Adjust Availability" CTA in the analytics screen. Without this, the platform has no way to manage GP load before launch.

---

## Background

At MVP, Nightingale operates with a single doctor (the Medical Director). Even with one GP, availability management is necessary: consultations should not be accepted at midnight if the doctor isn't reviewing until morning. The system must hold a patient's consultation in a "pending doctor" state and communicate expected response times clearly, rather than implying instant review.

This PRD must be live before beta launch. Any patient-facing promise of a response timeframe depends on knowing when doctors are available.

---

## User Roles & Access

| Role | Access |
|------|--------|
| Doctor | Sets and edits their own availability schedule; views their monthly capacity utilisation |
| Admin | Can view all doctor schedules; can override a doctor's availability in an emergency |
| Patient | Does not see doctor schedules directly; sees estimated response time derived from next available slot |

---

## Functional Requirements

### Availability Schedule

| # | Requirement |
|---|-------------|
| F-001 | Doctor sets a weekly recurring availability schedule: days of week + time windows (e.g., Mon–Fri 8am–6pm AEST) |
| F-002 | Doctor can override specific dates: mark as unavailable (e.g., public holiday, leave) or add ad-hoc availability |
| F-003 | Schedule is stored in AEST/AEDT; system converts to UTC for all internal processing |
| F-004 | Doctor can set a daily consultation cap: maximum number of consultations they will review in a single day |
| F-005 | When daily cap is reached, new incoming consultations are queued for the next available slot rather than being rejected |

### Capacity Tracking

| # | Requirement |
|---|-------------|
| F-006 | Doctor analytics view shows monthly capacity utilisation: consultations reviewed / monthly cap as a percentage |
| F-007 | When utilisation reaches 80%, admin receives an alert: "Doctor approaching capacity — consider adding a second GP" |
| F-008 | When utilisation reaches 100% (daily cap hit), the patient-facing consultation booking flow displays the next estimated response time based on the next available doctor slot |

### Patient-Facing Response Time Estimate

| # | Requirement |
|---|-------------|
| F-009 | Estimated response time shown on the new consultation screen is derived from the next available doctor slot, not a hardcoded string |
| F-010 | If a doctor is currently available and below daily cap: show "Typical wait time: ~X mins" (based on current queue length) |
| F-011 | If no doctor is currently available: show "Response expected by [next available slot time]" |
| F-012 | If all doctors are at daily cap: show "All doctors are at capacity today. Your consultation will be reviewed at [next slot]." Patient may proceed or cancel |

---

## Non-Functional Requirements

- **Timezone correctness:** All schedule logic in UTC; all doctor-facing displays in AEST/AEDT (handle DST transitions for NSW/VIC)
- **No blocking consultations:** A full schedule delays reviews, it never prevents a patient from completing an interview — the interview and AI processing proceed regardless; only delivery of the doctor's response is delayed

---

## Compliance Notes

**Audit log events:**

| Event | Trigger |
|-------|---------|
| `doctor.availability_updated` | Doctor saves a schedule change; includes doctor_id, old schedule hash, new schedule hash |
| `doctor.daily_cap_reached` | Daily cap hit for a doctor; admin alert triggered |

---

## Acceptance Criteria

- [ ] Doctor can set weekly recurring availability and save it
- [ ] Doctor can block out a specific date as unavailable
- [ ] Daily cap can be set; new consultations queue past the cap rather than being rejected
- [ ] Capacity utilisation % shows correctly in analytics view
- [ ] Patient-facing "estimated response time" reflects the actual next available doctor slot, not a hardcoded value
- [ ] Admin alert fires when utilisation hits 80%
- [ ] All times displayed in AEST/AEDT regardless of doctor's browser timezone

---

## Dependencies

- PRD-004: Doctor authentication (doctor must be logged in to set schedule)
- PRD-005: Audit log for schedule changes
- PRD-013: Doctor review dashboard (schedule accessible from same portal)

---

## Out of Scope

- Multi-timezone support for doctors outside AEST (Phase 2)
- Patient ability to book a specific time slot (consultation is asynchronous at MVP — patient interviews now, doctor reviews when available)
- GP marketplace / matching patients to specific doctors (Phase 2)
