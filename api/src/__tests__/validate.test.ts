/**
 * Unit tests for the validateBody middleware and core Zod schemas.
 * These tests do NOT require a database connection — they exercise
 * middleware and schema logic in isolation using plain mocks.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { CreateConsultationSchema } from "../schemas/consultation.schema";
import { RegisterPatientSchema, AddAllergySchema } from "../schemas/patient.schema";
import { CreateRenewalSchema } from "../schemas/renewal.schema";
import { RejectConsultationSchema } from "../schemas/doctor.schema";
import { ReassignConsultationSchema } from "../schemas/followup.schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(body: unknown): Request {
  return { body } as Request;
}

interface MockResContext {
  res: Response;
  statusCode: number | null;
  json: unknown;
}

function mockRes(): MockResContext {
  const ctx: MockResContext = {
    res: null as unknown as Response,
    statusCode: null,
    json: null,
  };
  const res = {
    status(code: number) {
      ctx.statusCode = code;
      return res;
    },
    json(body: unknown) {
      ctx.json = body;
      return res;
    },
  } as unknown as Response;
  ctx.res = res;
  return ctx;
}

// ---------------------------------------------------------------------------
// validateBody middleware
// ---------------------------------------------------------------------------

describe("validateBody middleware", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("calls next() when body is valid", () => {
    const req = mockReq({ name: "Alice" });
    const { res } = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when a required field is missing", () => {
    const req = mockReq({});
    const ctx = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, ctx.res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(400);
    expect((ctx.json as { error: string }).error).toBe("Validation failed");
  });

  it("returns structured details array with field and message", () => {
    const req = mockReq({});
    const ctx = mockRes();

    validateBody(schema)(req, ctx.res, jest.fn() as unknown as NextFunction);

    const body = ctx.json as { error: string; details: Array<{ field: string; message: string }> };
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", message: expect.any(String) }),
      ])
    );
  });

  it("does not call next() on validation failure", () => {
    const req = mockReq({ name: "" }); // too short — min(1)
    const ctx = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, ctx.res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// CreateConsultationSchema
// ---------------------------------------------------------------------------

describe("CreateConsultationSchema", () => {
  it("accepts valid voice consultation", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "voice",
      presentingComplaint: "sore throat",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid text consultation", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "text",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown consultationType", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "HACK",
      presentingComplaint: "test",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("consultationType");
    }
  });

  it("rejects missing consultationType", () => {
    const result = CreateConsultationSchema.safeParse({
      presentingComplaint: "headache",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("consultationType");
    }
  });

  it("accepts optional child fields", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "voice",
      isForChild: true,
      childName: "Jamie",
      childDob: "2018-01-01",
      guardianName: "Parent McParent",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RegisterPatientSchema
// ---------------------------------------------------------------------------

describe("RegisterPatientSchema", () => {
  it("accepts valid email and privacyPolicyVersion", () => {
    const result = RegisterPatientSchema.safeParse({
      email: "test@example.com",
      privacyPolicyVersion: "v1.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = RegisterPatientSchema.safeParse({
      email: "notanemail",
      privacyPolicyVersion: "v1.0",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("rejects missing email", () => {
    const result = RegisterPatientSchema.safeParse({
      privacyPolicyVersion: "v1.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing privacyPolicyVersion", () => {
    const result = RegisterPatientSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AddAllergySchema
// ---------------------------------------------------------------------------

describe("AddAllergySchema", () => {
  it("accepts valid allergy", () => {
    const result = AddAllergySchema.safeParse({ name: "Penicillin", severity: "severe" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = AddAllergySchema.safeParse({ name: "Penicillin", severity: "deadly" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("severity");
    }
  });

  it("rejects missing name", () => {
    const result = AddAllergySchema.safeParse({ severity: "mild" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreateRenewalSchema
// ---------------------------------------------------------------------------

describe("CreateRenewalSchema", () => {
  it("accepts valid renewal with just medicationName", () => {
    const result = CreateRenewalSchema.safeParse({ medicationName: "Metformin" });
    expect(result.success).toBe(true);
  });

  it("rejects missing medicationName", () => {
    const result = CreateRenewalSchema.safeParse({ dosage: "500mg" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("medicationName");
    }
  });

  it("accepts all optional fields", () => {
    const result = CreateRenewalSchema.safeParse({
      medicationName: "Metformin",
      sourceConsultationId: "abc-123",
      dosage: "500mg",
      noAdverseEffects: true,
      conditionUnchanged: true,
      patientNotes: "feeling fine",
      remindersEnabled: false,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RejectConsultationSchema
// ---------------------------------------------------------------------------

describe("RejectConsultationSchema", () => {
  it("accepts valid reasonCode", () => {
    const result = RejectConsultationSchema.safeParse({
      reasonCode: "physical_exam_required",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid reasonCode", () => {
    const result = RejectConsultationSchema.safeParse({
      reasonCode: "invalid_code",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("reasonCode");
    }
  });

  it("accepts optional message", () => {
    const result = RejectConsultationSchema.safeParse({
      reasonCode: "other",
      message: "Patient needs in-person care",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ReassignConsultationSchema
// ---------------------------------------------------------------------------

describe("ReassignConsultationSchema", () => {
  it("accepts valid doctorId", () => {
    const result = ReassignConsultationSchema.safeParse({ doctorId: "some-uuid" });
    expect(result.success).toBe(true);
  });

  it("rejects missing doctorId", () => {
    const result = ReassignConsultationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
