// C-06: Unit tests for withRetry exponential backoff helper (F-031)
// The anthropicClient module is mocked to avoid the tslib/bedrock-sdk resolution issue
// in Jest without tslib installed as a top-level dep.

// Mock the entire anthropicClient so the AWS SDK is never loaded
jest.mock("../services/anthropicClient", () => ({
  callClaude: jest.fn(),
}));

// Also mock rag and piiAnonymiser to avoid transitive DB/AWS deps
jest.mock("../services/rag", () => ({ retrieve: jest.fn() }));

import { withRetry } from "../services/clinicalAiEngine";

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to the specified count and succeeds on the last attempt", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after all retries are exhausted", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow("fail 3");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("makes exactly retries+1 total attempts on repeated failure (3 attempts for retries=2)", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // retries=2 → attempts 0,1,2
  });

  it("succeeds on first attempt without applying any delay", async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const result = await withRetry(fn, 3, 1000);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries=0 means only one attempt, throws immediately on failure", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("immediate fail"));
    await expect(withRetry(fn, 0, 0)).rejects.toThrow("immediate fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
