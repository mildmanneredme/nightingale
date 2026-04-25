import { z } from "zod";

const VALID_REASON_CODES = [
  "physical_exam_required",
  "insufficient_information",
  "outside_remote_scope",
  "other",
] as const;

/**
 * POST /api/v1/doctor/consultations/:id/amend
 */
export const AmendConsultationSchema = z.object({
  doctorDraft: z.string().min(1, "doctorDraft is required"),
  doctorNotes: z.string().optional(),
});

/**
 * POST /api/v1/doctor/consultations/:id/reject
 */
export const RejectConsultationSchema = z.object({
  reasonCode: z.enum(VALID_REASON_CODES),
  message: z.string().optional(),
});

/**
 * POST /api/v1/doctor/consultations/:id/approve
 * No required body fields — use passthrough to allow any extra keys.
 */
export const ApproveConsultationSchema = z.object({}).passthrough();
