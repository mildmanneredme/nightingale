# BUG-003 — Forgot Password Flow

**Type:** Missing feature / bug  
**Priority:** High — users with no password recovery path are locked out permanently  
**Sprint:** Next available  
**Scope:** Frontend only (Cognito handles the reset email natively)

---

## Problem Summary

The login page (`/login`) has no "Forgot password?" link. Users who cannot remember their password have no self-service recovery path and must contact support (which doesn't exist yet). This is a blocker for any real user going through staging or production.

Cognito already supports password reset natively via `forgotPassword` and `confirmForgotPassword` — this is purely a frontend wiring task.

---

## Flow

```
/login
  └─ "Forgot password?" link
       └─ /forgot-password          ← step 1: enter email, triggers Cognito reset email
            └─ /forgot-password     ← step 2 (same page): enter code + new password
                 └─ /login          ← success: redirect with "Password reset. Please sign in."
```

Cognito sends a 6-digit code to the user's email. The user enters it alongside their new password on step 2.

---

## Requirements

### F-001 — Forgot password page at `/forgot-password`

Two-step form on a single page (same pattern as the existing register page):

**Step 1 — Request reset**
- Email input
- "Send reset code" button
- On submit: call `forgotPassword(email)` from `auth.ts`
- On success: advance to step 2 (show email address as confirmation)
- On error: map Cognito exceptions to friendly messages (see F-003)

**Step 2 — Enter code + new password**
- Display: "We sent a code to {email}"
- 6-digit code input
- New password input (min 8 chars)
- "Reset password" button
- On submit: call `confirmForgotPassword(email, code, newPassword)` from `auth.ts`
- On success: redirect to `/login` with a one-time success message "Password reset successfully. Please sign in."
- On error: map Cognito exceptions (see F-003)

### F-002 — Login page link

Add "Forgot password?" as a small link below the password field on `/login`. Should navigate to `/forgot-password`.

### F-003 — Cognito error mapping (add to BUG-001 auth.ts mapping)

| Cognito exception | User-facing message |
|---|---|
| `UserNotFoundException` | "No account found with that email." |
| `LimitExceededException` | "Too many attempts. Please wait a few minutes and try again." |
| `CodeMismatchException` | "That code is incorrect. Please check and try again." |
| `ExpiredCodeException` | "That code has expired. Please request a new one." |
| `InvalidPasswordException` | "Password must be at least 8 characters." |

### F-004 — New `auth.ts` functions

Add to `web/src/lib/auth.ts`:

```typescript
forgotPassword(email: string): Promise<void>
confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>
```

Both should use `amazon-cognito-identity-js` (already installed) and apply the same error mapping pattern established in BUG-001.

---

## Out of Scope

- "Resend code" button (nice to have, can be added in a follow-up)
- Admin-initiated password reset (already possible via AWS CLI)
- Password strength indicator UI

---

## Acceptance Criteria

- [ ] `/login` has a "Forgot password?" link below the password field
- [ ] `/forgot-password` step 1 sends a reset code to the entered email
- [ ] `/forgot-password` step 2 accepts the code and new password and resets successfully
- [ ] Successful reset redirects to `/login` with a success message
- [ ] All Cognito error paths show human-readable messages (no exception class names)
- [ ] Page is publicly accessible (no auth guard)
- [ ] TypeScript check passes
