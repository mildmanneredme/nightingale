import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";
import { setToken } from "./api";

function getPool(): CognitoUserPool {
  const UserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const ClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!UserPoolId || !ClientId) {
    throw new Error(
      "Cognito is not configured. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID."
    );
  }
  return new CognitoUserPool({ UserPoolId, ClientId });
}

// In-memory token — mirrors what api.ts stores
let _storedToken: string | null = null;

export function getStoredToken(): string | null {
  return _storedToken;
}

function storeToken(token: string | null) {
  _storedToken = token;
  setToken(token);
}

// ---------------------------------------------------------------------------
// Cognito error code → user-facing message
// ---------------------------------------------------------------------------

function mapCognitoError(err: unknown): string {
  const code = (err as { code?: string; name?: string })?.code
    ?? (err as { name?: string })?.name;
  switch (code) {
    case "NotAuthorizedException":
      return "Incorrect email or password.";
    case "UserNotFoundException":
      return "No account found with that email.";
    case "UserNotConfirmedException":
      return "Please verify your email before signing in.";
    case "PasswordResetRequiredException":
      return "Your password must be reset. Use 'Forgot password?'.";
    case "TooManyRequestsException":
    case "LimitExceededException":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "CodeMismatchException":
      return "That code is incorrect. Please check and try again.";
    case "ExpiredCodeException":
      return "That code has expired. Please request a new one.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters.";
    default:
      return err instanceof Error ? err.message : "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

export function signIn(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pool = getPool();
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(auth, {
      onSuccess(session) {
        const token = session.getAccessToken().getJwtToken();
        storeToken(token);
        resolve(token);
      },
      onFailure(err) {
        reject(new Error(mapCognitoError(err)));
      },
    });
  });
}

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

export function signOut(): void {
  const user = getPool().getCurrentUser();
  user?.signOut();
  storeToken(null);
}

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attrs = [new CognitoUserAttribute({ Name: "email", Value: email })];

    getPool().signUp(email, password, attrs, [], (err) => {
      if (err) return reject(new Error(mapCognitoError(err)));
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// confirmSignUp
// ---------------------------------------------------------------------------

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });

    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(new Error(mapCognitoError(err)));
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// forgotPassword — step 1: request reset code
// ---------------------------------------------------------------------------

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });

    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(new Error(mapCognitoError(err))),
    });
  });
}

// ---------------------------------------------------------------------------
// confirmForgotPassword — step 2: submit code + new password
// ---------------------------------------------------------------------------

export function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });

    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(new Error(mapCognitoError(err))),
    });
  });
}

// ---------------------------------------------------------------------------
// getUserRole — decode Cognito JWT and resolve role from cognito:groups
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "doctor" | "patient";

export function getUserRole(token: string | null): UserRole | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const groups: string[] = payload["cognito:groups"] ?? [];
    if (groups.includes("admin")) return "admin";
    if (groups.includes("doctor")) return "doctor";
    return "patient";
  } catch {
    return null;
  }
}
