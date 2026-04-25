import { z } from "zod";

/**
 * POST /api/v1/followup/send  (scheduler — no patient body fields)
 * No required fields; use passthrough so any scheduler metadata doesn't fail.
 */
export const SendFollowUpSchema = z.object({}).passthrough();

/**
 * Admin reassign — defined here for convenience; used in admin routes.
 */
export const ReassignConsultationSchema = z.object({
  doctorId: z.string().min(1, "doctorId is required"),
});
