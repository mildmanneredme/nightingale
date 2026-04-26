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
  email: z.string().email("Invalid email address format").optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD format").optional(),
  biologicalSex: z.enum(VALID_BIOLOGICAL_SEX).optional(),
  phone: z.string().optional(),
  address: z.unknown().optional(),
  // Medicare numbers are 10 digits (card number) or 11 (with IRN suffix).
  medicareNumber: z.string().regex(/^\d{10,11}$/, "Medicare number must be 10 or 11 digits").optional(),
  ihiNumber: z.string().regex(/^\d{16}$/, "IHI number must be 16 digits").optional(),
  gpName: z.string().optional(),
  gpClinic: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRel: z.string().optional(),
  guardianName: z.string().optional(),
  guardianEmail: z.string().email().optional(),
  guardianRelationship: z.string().optional(),
  allergiesNoneDeclared: z.boolean().optional(),
  medicationsNoneDeclared: z.boolean().optional(),
  conditionsNoneDeclared: z.boolean().optional(),
});

/**
 * POST /api/v1/patients/me/onboarding-step
 * Records the patient's progression through the onboarding wizard.
 */
export const OnboardingStepSchema = z.object({
  step: z.number().int().min(1).max(3),
  skipped: z.boolean(),
  skippedFields: z.array(z.string()).optional(),
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
