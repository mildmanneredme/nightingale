/**
 * Unit tests for the validateBody middleware and core Zod schemas.
 * These tests do NOT require a database connection — they exercise
 * middleware and schema logic in isolation using plain mocks.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { CreateConsultationSchema } from "../schemas/consultation.schema";
import { RegisterPatientSchema, AddAllergySchema, UpdatePatientSchema } from "../schemas/patient.schema";
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

  it("returns field 'body' when entire request body is null", () => {
    const nullBodySchema = z.object({ name: z.string() });
    const req = mockReq(null);
    const ctx = mockRes();
    const next = jest.fn();

    validateBody(nullBodySchema)(req, ctx.res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(400);
    const body = ctx.json as { error: string; details: Array<{ field: string; message: string }> };
    // All issues produced from a null body have an empty path — field should be "body"
    expect(body.details.every((d) => d.field !== "")).toBe(true);
  });

  it("writes parsed result.data back to req.body (coercions/transforms applied)", () => {
    const trimSchema = z.object({ name: z.string().trim() });
    const req = mockReq({ name: "  Alice  " });
    const { res } = mockRes();
    const next = jest.fn();

    validateBody(trimSchema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.name).toBe("Alice");
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
      presentingComplaint: "headache",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing presentingComplaint", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "voice",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("presentingComplaint");
    }
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
      presentingComplaint: "ear pain",
      isForChild: true,
      childName: "Jamie",
      childDob: "2018-01-01",
      guardianName: "Parent McParent",
    });
    expect(result.success).toBe(true);
  });

  it("rejects whitespace-only presentingComplaint", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "voice",
      presentingComplaint: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("presentingComplaint");
    }
  });

  it("trims presentingComplaint before storing", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "text",
      presentingComplaint: "  headache  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentingComplaint).toBe("headache");
    }
  });

  it("rejects invalid childDob format", () => {
    const result = CreateConsultationSchema.safeParse({
      consultationType: "voice",
      presentingComplaint: "ear pain",
      childDob: "01/01/2018",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("childDob");
    }
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
// UpdatePatientSchema
// ---------------------------------------------------------------------------

describe("UpdatePatientSchema", () => {
  it("accepts a valid email on patient update", () => {
    const result = UpdatePatientSchema.safeParse({ email: "new@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email on patient update", () => {
    const result = UpdatePatientSchema.safeParse({ email: "notanemail" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("accepts an empty object (all fields optional)", () => {
    const result = UpdatePatientSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid 10-digit Medicare number", () => {
    const result = UpdatePatientSchema.safeParse({ medicareNumber: "2123456701" });
    expect(result.success).toBe(true);
  });

  it("rejects a Medicare number with wrong digit count", () => {
    const result = UpdatePatientSchema.safeParse({ medicareNumber: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("medicareNumber");
    }
  });

  it("accepts a valid 16-digit IHI number", () => {
    const result = UpdatePatientSchema.safeParse({ ihiNumber: "8003608166690503" });
    expect(result.success).toBe(true);
  });

  it("rejects an IHI number with non-digit characters", () => {
    const result = UpdatePatientSchema.safeParse({ ihiNumber: "800360816669050X" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("ihiNumber");
    }
  });

  it("accepts a valid YYYY-MM-DD date of birth", () => {
    const result = UpdatePatientSchema.safeParse({ dateOfBirth: "1990-06-15" });
    expect(result.success).toBe(true);
  });

  it("rejects a date of birth in non-ISO format", () => {
    const result = UpdatePatientSchema.safeParse({ dateOfBirth: "15/06/1990" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("dateOfBirth");
    }
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

  it("rejects whitespace-only medicationName", () => {
    const result = CreateRenewalSchema.safeParse({ medicationName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("medicationName");
    }
  });

  it("trims medicationName before storing", () => {
    const result = CreateRenewalSchema.safeParse({ medicationName: "  Metformin  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.medicationName).toBe("Metformin");
    }
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
