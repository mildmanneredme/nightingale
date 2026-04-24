import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  getConsultations,
  createConsultation,
  getConsultation,
  endConsultation,
  getMe,
  updateMe,
  registerPatient,
  addAllergy,
  deleteAllergy,
  addMedication,
  deleteMedication,
  addCondition,
  deleteCondition,
} from "@/lib/api";

// Token store is internal — tests inject via module-level setter
import { setToken } from "@/lib/api";

beforeEach(() => {
  // Default: always returns 200 so fire-and-forget calls (e.g. reportClientError) don't crash
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({}),
  }));
  setToken("test-access-token");
});

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("carries status and message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Authorization header
// ---------------------------------------------------------------------------

describe("Authorization header", () => {
  it("attaches Bearer token to every request", async () => {
    mockFetch(200, []);
    await getConsultations();
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-access-token",
    });
  });

  it("throws ApiError 401 on missing token", async () => {
    setToken(null);
    await expect(getConsultations()).rejects.toThrow(ApiError);
    await expect(getConsultations()).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// getConsultations
// ---------------------------------------------------------------------------

describe("getConsultations", () => {
  it("GETs /api/v1/consultations and returns the array", async () => {
    const list = [{ id: "abc", status: "pending" }];
    mockFetch(200, list);
    const result = await getConsultations();
    expect(result).toEqual(list);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/consultations");
  });

  it("throws ApiError on non-2xx", async () => {
    mockFetch(500, { error: "boom" });
    await expect(getConsultations()).rejects.toMatchObject({ status: 500 });
  });
});

// ---------------------------------------------------------------------------
// createConsultation
// ---------------------------------------------------------------------------

describe("createConsultation", () => {
  it("POSTs with consultationType and presentingComplaint", async () => {
    mockFetch(201, { id: "new-id", status: "pending" });
    const result = await createConsultation("voice", "sore throat");
    expect(result.id).toBe("new-id");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/consultations");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      consultationType: "voice",
      presentingComplaint: "sore throat",
    });
  });
});

// ---------------------------------------------------------------------------
// getConsultation
// ---------------------------------------------------------------------------

describe("getConsultation", () => {
  it("GETs /api/v1/consultations/:id", async () => {
    const consultation = { id: "c1", status: "transcript_ready" };
    mockFetch(200, consultation);
    const result = await getConsultation("c1");
    expect(result).toEqual(consultation);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/consultations/c1");
  });

  it("throws ApiError 404 when not found", async () => {
    mockFetch(404, { error: "Not found" });
    await expect(getConsultation("bad-id")).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// endConsultation
// ---------------------------------------------------------------------------

describe("endConsultation", () => {
  it("POSTs to /:id/end with transcript", async () => {
    const transcript = [{ speaker: "ai" as const, text: "Hello", timestamp_ms: 0 }];
    mockFetch(200, { status: "transcript_ready" });
    await endConsultation("c1", transcript);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/consultations/c1/end");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ transcript });
  });
});

// ---------------------------------------------------------------------------
// registerPatient
// ---------------------------------------------------------------------------

describe("registerPatient", () => {
  it("POSTs to /api/v1/patients/register", async () => {
    mockFetch(201, { id: "p1", email: "a@b.com" });
    const result = await registerPatient("a@b.com", "v1.0");
    expect(result.id).toBe("p1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/patients/register");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      email: "a@b.com",
      privacyPolicyVersion: "v1.0",
    });
  });
});

// ---------------------------------------------------------------------------
// getMe / updateMe
// ---------------------------------------------------------------------------

describe("getMe", () => {
  it("GETs /api/v1/patients/me", async () => {
    mockFetch(200, { id: "p1", email: "a@b.com", allergies: [] });
    const result = await getMe();
    expect(result.email).toBe("a@b.com");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/patients/me");
  });
});

describe("updateMe", () => {
  it("PUTs to /api/v1/patients/me", async () => {
    mockFetch(200, { fullName: "Sarah" });
    await updateMe({ fullName: "Sarah" });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ fullName: "Sarah" });
  });
});

// ---------------------------------------------------------------------------
// Medical history mutations
// ---------------------------------------------------------------------------

describe("addAllergy", () => {
  it("POSTs to /me/allergies", async () => {
    mockFetch(201, { id: "a1", name: "Penicillin", severity: "severe" });
    const result = await addAllergy("Penicillin", "severe");
    expect(result.id).toBe("a1");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/patients/me/allergies");
  });
});

describe("deleteAllergy", () => {
  it("DELETEs /me/allergies/:id", async () => {
    mockFetch(204, null);
    await deleteAllergy("a1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/patients/me/allergies/a1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("addMedication", () => {
  it("POSTs to /me/medications", async () => {
    mockFetch(201, { id: "m1", name: "Aspirin" });
    const result = await addMedication("Aspirin", "100mg", "daily");
    expect(result.id).toBe("m1");
  });
});

describe("deleteMedication", () => {
  it("DELETEs /me/medications/:id", async () => {
    mockFetch(204, null);
    await deleteMedication("m1");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("addCondition", () => {
  it("POSTs to /me/conditions", async () => {
    mockFetch(201, { id: "cond1", name: "Diabetes" });
    const result = await addCondition("Diabetes");
    expect(result.id).toBe("cond1");
  });
});

describe("deleteCondition", () => {
  it("DELETEs /me/conditions/:id", async () => {
    mockFetch(204, null);
    await deleteCondition("cond1");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
