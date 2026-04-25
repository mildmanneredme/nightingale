import { z } from "zod";

/**
 * POST /api/v1/consultations
 * Creates a new consultation. consultationType must be "voice" or "text".
 */
export const CreateConsultationSchema = z.object({
  consultationType: z.enum(["voice", "text"]),
  presentingComplaint: z.string().trim().min(1, "Presenting complaint is required"),
  isAnonymous: z.boolean().optional(),
  isForChild: z.boolean().optional(),
  childName: z.string().optional(),
  childDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  guardianName: z.string().optional(),
});

/**
 * POST /api/v1/consultations/:id/end
 * Ends a voice consultation and stores the transcript.
 * transcript is optional (can be absent or null).
 */
export const EndConsultationSchema = z.object({
  transcript: z.array(z.unknown()).optional().nullable(),
});

/**
 * POST /api/v1/consultations/:id/chat
 * Sends a message in a text consultation.
 */
export const ChatMessageSchema = z.object({
  message: z.string().trim().min(1, "message is required"),
});
