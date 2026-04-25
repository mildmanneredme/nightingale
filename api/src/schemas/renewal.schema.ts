import { z } from "zod";

/**
 * POST /api/v1/renewals
 * Patient submits a script renewal request.
 */
export const CreateRenewalSchema = z.object({
  medicationName: z.string().trim().min(1, "Medication name is required"),
  sourceConsultationId: z.string().optional(),
  dosage: z.string().optional(),
  noAdverseEffects: z.boolean().optional(),
  conditionUnchanged: z.boolean().optional(),
  patientNotes: z.string().optional(),
  remindersEnabled: z.boolean().optional(),
});

/**
 * POST /api/v1/renewals/:id/approve  (doctor only)
 * Approves a renewal request. All fields optional.
 */
export const ApproveRenewalSchema = z.object({
  reviewNote: z.string().optional(),
  validDays: z.number().int().positive().optional(),
});

/**
 * POST /api/v1/renewals/:id/decline  (doctor only)
 * Declines a renewal request. All fields optional.
 */
export const DeclineRenewalSchema = z.object({
  reviewNote: z.string().optional(),
});
