import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getErrorMessage, reportClientError } from "@/lib/errors";
import { ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// getErrorMessage
// ---------------------------------------------------------------------------

describe("getErrorMessage", () => {
  it("returns correct title/detail for 400", () => {
    const result = getErrorMessage(400);
    expect(result.title).toBe("Something doesn't look right");
    expect(result.detail).toBe("Please check your input and try again.");
  });

  it("returns correct title/detail for 401", () => {
    const result = getErrorMessage(401);
    expect(result.title).toBe("You've been signed out");
    expect(result.detail).toBe("Please sign in again to continue.");
  });

  it("returns correct title/detail for 500", () => {
    const result = getErrorMessage(500);
    expect(result.title).toBe("Something went wrong on our end");
    expect(result.detail).toBe(
      "Our team has been notified. Please try again in a few minutes."
    );
  });

  it("returns correct title/detail for 503", () => {
    const result = getErrorMessage(503);
    expect(result.title).toBe("Service temporarily unavailable");
    expect(result.detail).toBe(
      "We're experiencing high demand. Please try again shortly."
    );
  });

  it("returns default message for unknown status (e.g. 418)", () => {
    const result = getErrorMessage(418);
    expect(result.title).toBe("Something went wrong");
    expect(result.detail).toBe("Please try again.");
  });
});

// ---------------------------------------------------------------------------
// reportClientError
// ---------------------------------------------------------------------------

describe("reportClientError", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls fetch with correct URL and body", async () => {
    reportClientError("CLIENT.TEST", "something broke", "req-123", "/dashboard");
    // Give microtasks a tick to run
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:8080/api/v1/client-error");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      errorCode: "CLIENT.TEST",
      errorMessage: "something broke",
      correlationId: "req-123",
      page: "/dashboard",
    });
  });

  it("does not throw when fetch rejects", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));
    // Must not throw
    expect(() =>
      reportClientError("CLIENT.FAIL", "oops")
    ).not.toThrow();
    // Allow rejection to be swallowed
    await new Promise((r) => setTimeout(r, 0));
  });

  it("truncates errorMessage to 500 chars", async () => {
    const longMessage = "x".repeat(600);
    reportClientError("CLIENT.LONG", longMessage);
    await new Promise((r) => setTimeout(r, 0));
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.errorMessage).toHaveLength(500);
  });
});

// ---------------------------------------------------------------------------
// ApiError with correlationId
// ---------------------------------------------------------------------------

describe("ApiError with correlationId", () => {
  it("stores correlationId when provided", () => {
    const err = new ApiError(500, "Server error", "req-xyz");
    expect(err.correlationId).toBe("req-xyz");
    expect(err.status).toBe(500);
    expect(err.message).toBe("Server error");
  });

  it("correlationId is undefined when not provided", () => {
    const err = new ApiError(404, "Not found");
    expect(err.correlationId).toBeUndefined();
  });
});
