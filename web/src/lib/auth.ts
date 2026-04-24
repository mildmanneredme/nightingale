import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";
import { setToken } from "./api";

function getPool(): CognitoUserPool {
  return new CognitoUserPool({
    UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
    ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
  });
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
        reject(err instanceof Error ? err : new Error(String(err)));
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
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
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
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      resolve();
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
