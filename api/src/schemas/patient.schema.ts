import { z } from "zod";

const VALID_BIOLOGICAL_SEX = ["male", "female", "intersex", "prefer_not_to_say"] as const;
const VALID_SEVERITY = ["mild", "moderate", "severe"] as const;

/**
 * POST /api/v1/patients/register
 */
export const RegisterPatientSchema = z.object({
  email: z.string().email("Invalid email address format"),
  privacyPolicyVersion: z.string().min(1, "privacyPolicyVersion is required"),
});

/**
 * PUT /api/v1/patients/me
 * All fields optional for partial update.
 */
export const UpdatePatientSchema = z.object({
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  biologicalSex: z.enum(VALID_BIOLOGICAL_SEX).optional(),
  phone: z.string().optional(),
  address: z.unknown().optional(),
  medicareNumber: z.string().optional(),
  ihiNumber: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRel: z.string().optional(),
  guardianName: z.string().optional(),
  guardianEmail: z.string().email().optional(),
  guardianRelationship: z.string().optional(),
});

/**
 * POST /api/v1/patients/me/allergies
 */
export const AddAllergySchema = z.object({
  name: z.string().min(1, "name is required"),
  severity: z.enum(VALID_SEVERITY),
});

/**
 * POST /api/v1/patients/me/medications
 */
export const AddMedicationSchema = z.object({
  name: z.string().min(1, "name is required"),
  dose: z.string().optional(),
  frequency: z.string().optional(),
});

/**
 * POST /api/v1/patients/me/conditions
 */
export const AddConditionSchema = z.object({
  name: z.string().min(1, "name is required"),
});
