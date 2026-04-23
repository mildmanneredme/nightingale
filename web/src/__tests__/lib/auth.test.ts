import { describe, it, expect, vi, beforeEach } from "vitest";
import { signIn, signOut, signUp, confirmSignUp, getStoredToken } from "@/lib/auth";

// Mock amazon-cognito-identity-js at module level
vi.mock("amazon-cognito-identity-js", () => {
  const mockAuthenticate = vi.fn();
  const mockSignUp = vi.fn();
  const mockConfirmRegistration = vi.fn();
  const mockSignOut = vi.fn();

  const CognitoUser = vi.fn(() => ({
    authenticateUser: mockAuthenticate,
    confirmRegistration: mockConfirmRegistration,
    signOut: mockSignOut,
  }));

  const CognitoUserPool = vi.fn(() => ({
    signUp: mockSignUp,
    getCurrentUser: vi.fn(() => null),
  }));

  const AuthenticationDetails = vi.fn((d: unknown) => d);
  const CognitoUserAttribute = vi.fn((a: unknown) => a);

  return { CognitoUser, CognitoUserPool, AuthenticationDetails, CognitoUserAttribute };
});

// Helpers to grab mock internals
async function getMocks() {
  const mod = await import("amazon-cognito-identity-js");
  return {
    CognitoUser: mod.CognitoUser as ReturnType<typeof vi.fn>,
    CognitoUserPool: mod.CognitoUserPool as ReturnType<typeof vi.fn>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getStoredToken
// ---------------------------------------------------------------------------

describe("getStoredToken", () => {
  it("returns null when no sign-in has occurred", () => {
    expect(getStoredToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe("signIn", () => {
  it("calls authenticateUser and resolves with the access token on success", async () => {
    const { CognitoUser } = await getMocks();
    const fakeToken = "access-token-xyz";

    // Make authenticateUser call onSuccess with a mock session
    CognitoUser.mockImplementation(() => ({
      authenticateUser: (_: unknown, callbacks: Record<string, Function>) => {
        callbacks.onSuccess({
          getAccessToken: () => ({ getJwtToken: () => fakeToken }),
        });
      },
      signOut: vi.fn(),
    }));

    const token = await signIn("user@example.com", "password123");
    expect(token).toBe(fakeToken);
  });

  it("rejects with the error message on failure", async () => {
    const { CognitoUser } = await getMocks();

    CognitoUser.mockImplementation(() => ({
      authenticateUser: (_: unknown, callbacks: Record<string, Function>) => {
        callbacks.onFailure(new Error("Incorrect username or password."));
      },
      signOut: vi.fn(),
    }));

    await expect(signIn("user@example.com", "wrong")).rejects.toThrow(
      "Incorrect username or password."
    );
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe("signOut", () => {
  it("clears the stored token", async () => {
    const { CognitoUser } = await getMocks();
    const mockSignOutFn = vi.fn();

    CognitoUser.mockImplementation(() => ({
      authenticateUser: (_: unknown, callbacks: Record<string, Function>) => {
        callbacks.onSuccess({
          getAccessToken: () => ({ getJwtToken: () => "tok" }),
        });
      },
      signOut: mockSignOutFn,
    }));

    await signIn("user@example.com", "password123");
    expect(getStoredToken()).toBe("tok");

    signOut();
    expect(getStoredToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe("signUp", () => {
  it("calls userPool.signUp and resolves on success", async () => {
    const { CognitoUserPool } = await getMocks();

    CognitoUserPool.mockImplementation(() => ({
      signUp: (_email: string, _pw: string, _attrs: unknown, _: unknown, cb: Function) => {
        cb(null, { user: { getUsername: () => "user@example.com" } });
      },
      getCurrentUser: vi.fn(() => null),
    }));

    await expect(signUp("user@example.com", "Password1!")).resolves.toBeUndefined();
  });

  it("rejects on Cognito error", async () => {
    const { CognitoUserPool } = await getMocks();

    CognitoUserPool.mockImplementation(() => ({
      signUp: (_: unknown, __: unknown, ___: unknown, ____: unknown, cb: Function) => {
        cb(new Error("UsernameExistsException"));
      },
      getCurrentUser: vi.fn(() => null),
    }));

    await expect(signUp("user@example.com", "Password1!")).rejects.toThrow(
      "UsernameExistsException"
    );
  });
});

// ---------------------------------------------------------------------------
// confirmSignUp
// ---------------------------------------------------------------------------

describe("confirmSignUp", () => {
  it("calls confirmRegistration and resolves on success", async () => {
    const { CognitoUser } = await getMocks();

    CognitoUser.mockImplementation(() => ({
      confirmRegistration: (_code: string, _force: boolean, cb: Function) => {
        cb(null, "SUCCESS");
      },
    }));

    await expect(confirmSignUp("user@example.com", "123456")).resolves.toBeUndefined();
  });

  it("rejects with invalid code error", async () => {
    const { CognitoUser } = await getMocks();

    CognitoUser.mockImplementation(() => ({
      confirmRegistration: (_: unknown, __: unknown, cb: Function) => {
        cb(new Error("CodeMismatchException"));
      },
    }));

    await expect(confirmSignUp("user@example.com", "000000")).rejects.toThrow(
      "CodeMismatchException"
    );
  });
});
