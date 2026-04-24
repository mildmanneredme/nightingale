import { describe, it, expect } from "vitest";
import { getUserRole } from "@/lib/auth";

// Build a minimal JWT with the given payload
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.fakesig`;
}

describe("getUserRole", () => {
  it("returns null for null token", () => {
    expect(getUserRole(null)).toBeNull();
  });

  it("returns null for malformed token", () => {
    expect(getUserRole("not-a-jwt")).toBeNull();
  });

  it("returns 'admin' when cognito:groups includes admin", () => {
    const token = makeJwt({ sub: "u1", "cognito:groups": ["admin"] });
    expect(getUserRole(token)).toBe("admin");
  });

  it("returns 'doctor' when cognito:groups includes doctor", () => {
    const token = makeJwt({ sub: "u2", "cognito:groups": ["doctor"] });
    expect(getUserRole(token)).toBe("doctor");
  });

  it("returns 'patient' when no groups present", () => {
    const token = makeJwt({ sub: "u3" });
    expect(getUserRole(token)).toBe("patient");
  });

  it("returns 'patient' when groups is an empty array", () => {
    const token = makeJwt({ sub: "u4", "cognito:groups": [] });
    expect(getUserRole(token)).toBe("patient");
  });

  it("prefers admin over doctor when both groups present", () => {
    const token = makeJwt({ sub: "u5", "cognito:groups": ["admin", "doctor"] });
    expect(getUserRole(token)).toBe("admin");
  });
});
