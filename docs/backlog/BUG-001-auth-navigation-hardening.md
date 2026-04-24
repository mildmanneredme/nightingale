# BUG-001 — Auth & Navigation Hardening

**Type:** Bug fix bundle  
**Priority:** High — blocks first-time users from finding the app and surfaces raw technical errors  
**Sprint:** Next available  
**Scope:** Frontend only

---

## Problem Summary

Three related issues found during initial staging exploration:

1. The root URL `/` shows a "Page Not Found" error — there is no landing route, so new users arriving at the app have nowhere to go.
2. Entering a verification code without having first registered shows "Failed to fetch" — a raw network/Cognito error with no user guidance.
3. Attempting to register with an already-registered email shows the raw Cognito message "User already exists" — technically accurate but unhelpful and exposes implementation detail.

---

## Root Causes

| # | Issue | File | Root Cause |
|---|-------|------|------------|
| 1 | `/` returns 404 | `web/src/app/page.tsx` — missing | No root route defined; Next.js falls through to `not-found.tsx` |
| 2 | "Failed to fetch" on verify | `web/src/app/(auth)/register/page.tsx` line 53 | Raw Cognito/network error passed directly to UI |
| 3 | "User already exists" on re-register | `web/src/app/(auth)/register/page.tsx` line 36 | Raw `UsernameExistsException` message passed directly to UI |

---

## Requirements

### F-001 — Root route `/`

- If the user has no token: redirect to `/login`
- If the user has a valid token: redirect to role-appropriate home (`/dashboard` for patient, `/doctor/queue` for doctor, `/admin/beta` for admin)
- Must be a client component (token lives in React state)
- No loading flash — redirect should be immediate

### F-002 — Cognito error message mapping

Map the following Cognito exception names to user-friendly copy in `web/src/lib/auth.ts` so all callers benefit automatically:

| Cognito exception | User-facing message |
|---|---|
| `UsernameExistsException` | "An account with this email already exists. Please sign in instead." |
| `NotAuthorizedException` | "Incorrect email or password." |
| `CodeMismatchException` | "That code is incorrect. Please check and try again." |
| `ExpiredCodeException` | "That code has expired. Please request a new one." |
| `UserNotFoundException` | "No account found with that email." |
| `LimitExceededException` | "Too many attempts. Please wait a few minutes and try again." |
| `InvalidPasswordException` | "Password does not meet requirements. Use at least 8 characters." |
| Network / unknown | "Something went wrong. Please check your connection and try again." |

Mapping should happen inside each function in `auth.ts` (`signUp`, `confirmSignUp`, `signIn`) by catching the exception and rethrowing with a friendly message, so the component catch blocks receive clean copy.

### F-003 — Verification step guard

On the verify step, if `confirmSignUp` throws `NotAuthorizedException` (user never registered), show: "No account found for this email. Please register first." and reset the form back to the registration step.

---

## Out of Scope

- Password reset / forgot password flow (separate PRD)
- Email resend button on the verification step (can be added later)
- Any changes to the API or Cognito configuration

---

## Acceptance Criteria

- [ ] Navigating to `/` redirects to `/login` for unauthenticated users
- [ ] Navigating to `/` redirects to the correct home for authenticated users
- [ ] Registering an existing email shows a human-readable message, not a Cognito exception name
- [ ] Entering a verification code for an unregistered email shows a human-readable message
- [ ] All Cognito error paths show copy that does not expose exception class names or "fetch" errors
- [ ] TypeScript check passes
- [ ] Existing auth tests still pass
