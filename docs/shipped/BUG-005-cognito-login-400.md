# BUG-005 — Cognito Login Returns 400, No Error Surfaced to User

**Type:** Bug — authentication / configuration  
**Status:** Shipped 2026-04-25 — `getPool()` guard throws clear dev error when env vars missing; `mapCognitoError()` covers all Cognito error codes; login page renders errors inline.  
**Priority:** P0 — users cannot log in; login failure is silent (no error message shown)  
**Sprint:** Sprint 8  
**Scope:** Frontend (`web/src/lib/auth.ts`, `web/src/app/(auth)/login/page.tsx`)

---

## Problem Summary

The login page produces a Cognito 400 error, and the user sees no feedback — the UI appears to accept the attempt and silently fails.

```
cognito-idp.ap-southeast-2.amazonaws.com/:1
  Failed to load resource: the server responded with a status of 400 ()
```

A 400 from Cognito on `InitiateAuth` (the sign-in request) means one of:

1. **Missing or invalid Cognito env vars** — `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and/or `NEXT_PUBLIC_COGNITO_CLIENT_ID` are not set in the Vercel deployment, causing `auth.ts` to fall back to `""` (empty string), which Cognito rejects as a malformed request.
2. **Wrong credentials** — Cognito returns 400 for `NotAuthorizedException` (wrong password) and `UserNotFoundException` (no such account) — both of which are surfaced as 400 HTTP responses.

In either case, the login page does not show the error to the user. The `onFailure` callback in `signIn()` rejects the Promise, but the calling code on the login page does not render the error.

---

## Cause A — Missing Cognito env vars in deployment

**`web/src/lib/auth.ts` lines 11–12:**

```typescript
UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
ClientId:   process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
```

If these are not set in the Vercel environment (project → Settings → Environment Variables), both default to `""`. Cognito rejects the `InitiateAuth` request immediately with 400 (`InvalidParameterException: Missing required parameter USER_POOL_ID`).

**Fix:** Set `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` in the Vercel project environment variables for all environments (Production, Preview, Development). Values come from the AWS Cognito user pool created during PRD-004.

---

## Cause B — Login page does not display auth errors

Even when Cognito env vars are correct, wrong credentials (or any other Cognito error) produce a 400. The current login page catches the rejection but does not render the error message.

**Fix — `web/src/app/(auth)/login/page.tsx`:**

Apply the same Cognito error mapping pattern established in BUG-001. The login form should display a human-readable message inline below the form on any `signIn()` rejection.

### Error mapping for login

| Cognito exception | User-facing message |
|---|---|
| `NotAuthorizedException` | "Incorrect email or password." |
| `UserNotFoundException` | "No account found with that email." |
| `UserNotConfirmedException` | "Please verify your email before signing in." |
| `PasswordResetRequiredException` | "Your password must be reset. Please use 'Forgot password?'." |
| `TooManyRequestsException` / `LimitExceededException` | "Too many attempts. Please wait a few minutes and try again." |
| Any other error | "Sign in failed. Please try again." |

---

## Requirements

### F-001 — Set Cognito env vars in Vercel

Ensure the following are set in Vercel → Project Settings → Environment Variables for all environments:

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` — e.g. `ap-southeast-2_XXXXXXXXX`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` — the app client ID from the Cognito user pool

### F-002 — Add runtime guard in `auth.ts`

Add an early check in `getPool()` to throw a clear developer-facing error if the env vars are missing, rather than silently passing empty strings to Cognito:

```typescript
function getPool(): CognitoUserPool {
  const UserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const ClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!UserPoolId || !ClientId) {
    throw new Error("Cognito env vars not configured");
  }
  return new CognitoUserPool({ UserPoolId, ClientId });
}
```

This surfaces the misconfiguration at the point of first use rather than producing a cryptic Cognito 400.

### F-003 — Render sign-in errors on the login page

The login page must catch the `signIn()` rejection and display a human-readable message inline. Apply the Cognito error code mapping from the table above. No raw exception class names should appear to the user.

---

## Out of Scope

- Password reset flow (covered by BUG-003)
- MFA configuration (deferred to post-beta hardening)

---

## Acceptance Criteria

- [ ] Login with correct credentials succeeds on staging (no Cognito 400)
- [ ] Login with wrong password shows "Incorrect email or password." inline — no console error visible to user
- [ ] Login with unregistered email shows "No account found with that email."
- [ ] Login with unverified account shows the verify-email prompt
- [ ] `getPool()` throws a clear error in dev if env vars are missing (not an empty-string Cognito 400)
- [ ] No raw Cognito exception class names appear in the UI
- [ ] TypeScript check passes
