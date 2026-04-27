import { Router, RequestHandler } from "express";
import { validateBody } from "../middleware/validate";
import {
  RegisterPatientSchema,
  UpdatePatientSchema,
  AddAllergySchema,
  AddMedicationSchema,
  AddConditionSchema,
  OnboardingStepSchema,
} from "../schemas/patient.schema";
import {
  insertPatient,
  findPatientBySub,
  findPatientIdBySub,
  updatePatient,
  softDeletePatient,
  findPatientAllergies,
  findPatientMedications,
  findPatientConditions,
  insertAllergy,
  deleteAllergy,
  insertMedication,
  deleteMedication,
  insertCondition,
  deleteCondition,
  recordOnboardingStep,
  markOnboardingComplete,
  PatientRow,
  AllergyRow,
  MedicationRow,
  ConditionRow,
} from "../repositories/patient.repository";

// ---------------------------------------------------------------------------
// PRD-023: profile completeness
//
// Required fields gate doctor approval (per Medical Director sign-off pending);
// optional fields are nice-to-have. Clinical-baseline sections are "answered"
// when there is at least one record OR the patient has explicitly declared
// they have none of that category.
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS: { key: keyof PatientRow; label: string }[] = [
  { key: "firstName",     label: "First name" },
  { key: "lastName",      label: "Last name" },
  { key: "dateOfBirth",   label: "Date of birth" },
  { key: "biologicalSex", label: "Biological sex" },
  { key: "phone",         label: "Phone number" },
  { key: "address",       label: "Address" },
];

const OPTIONAL_FIELDS: { key: keyof PatientRow; label: string }[] = [
  { key: "preferredName",   label: "Preferred name" },
  { key: "medicareNumber",  label: "Medicare number" },
  { key: "gpName",          label: "Regular GP" },
  { key: "gpClinic",        label: "GP clinic" },
];

function computeCompleteness(
  patient: PatientRow,
  allergies: AllergyRow[],
  medications: MedicationRow[],
  conditions: ConditionRow[]
) {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const f of REQUIRED_FIELDS) {
    if (!patient[f.key]) missingRequired.push(f.label);
  }
  for (const f of OPTIONAL_FIELDS) {
    if (!patient[f.key]) missingOptional.push(f.label);
  }

  // Clinical-baseline sections each count as one "field" toward completeness.
  if (allergies.length === 0 && !patient.allergiesNoneDeclared) {
    missingRequired.push("Allergies (or confirm none)");
  }
  if (medications.length === 0 && !patient.medicationsNoneDeclared) {
    missingRequired.push("Current medications (or confirm none)");
  }
  if (conditions.length === 0 && !patient.conditionsNoneDeclared) {
    missingRequired.push("Known conditions (or confirm none)");
  }

  // The headline percentage is gated on REQUIRED fields + baseline sections so
  // it matches the list rendered to the patient ("doctor needs the following…").
  // Optional fields are tracked separately so other surfaces can still see them.
  const requiredSlots = REQUIRED_FIELDS.length + 3; // +3 baseline sections
  const filledRequired = requiredSlots - missingRequired.length;
  const percentage = Math.round((filledRequired / requiredSlots) * 100);

  return { percentage, missingRequired, missingOptional };
}

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
router.post("/register", validateBody(RegisterPatientSchema), async (req, res, next) => {
  try {
    const { email, privacyPolicyVersion } = req.body;
    const sub = cognitoSub(req);
    const row = await insertPatient(sub, email, privacyPolicyVersion);
    res.status(201).json(row);
  } catch (err: any) {
    // Unique violation on cognito_sub
    if (err.code === "23505") {
      res.status(409).json({ error: "Patient already registered" });
      return;
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------
router.get("/me", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const patient = await findPatientBySub(sub);

    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const [allergies, medications, conditions] = await Promise.all([
      findPatientAllergies(patient.id),
      findPatientMedications(patient.id),
      findPatientConditions(patient.id),
    ]);

    const completeness = computeCompleteness(patient, allergies, medications, conditions);

    res.json({
      ...patient,
      allergies,
      medications,
      conditions,
      completeness,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /me
// ---------------------------------------------------------------------------
router.put("/me", validateBody(UpdatePatientSchema), async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const row = await updatePatient(sub, req.body);

    if (!row) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /me/onboarding-step  (PRD-023 F-020)
// Records progression through the onboarding wizard. Final step (3) marks
// onboarding complete in the same call so the wizard finish handler is atomic.
// ---------------------------------------------------------------------------
router.post(
  "/me/onboarding-step",
  validateBody(OnboardingStepSchema),
  async (req, res, next) => {
    try {
      const sub = cognitoSub(req);
      const { step, skipped, skippedFields } = req.body;

      await recordOnboardingStep(sub, step, skipped, skippedFields ?? []);
      if (step === 3) await markOnboardingComplete(sub);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------
router.post("/me/allergies", validateBody(AddAllergySchema), async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name, severity } = req.body;

    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const row = await insertAllergy(patient.id, name, severity ?? null);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/allergies/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const count = await deleteAllergy(req.params.id, patient.id);
    if (!count) {
      res.status(404).json({ error: "Allergy not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------
router.post("/me/medications", validateBody(AddMedicationSchema), async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name, dose, frequency } = req.body;

    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const row = await insertMedication(patient.id, name, dose ?? null, frequency ?? null);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/medications/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const count = await deleteMedication(req.params.id, patient.id);
    if (!count) {
      res.status(404).json({ error: "Medication not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------
router.post("/me/conditions", validateBody(AddConditionSchema), async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name } = req.body;

    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const row = await insertCondition(patient.id, name);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/conditions/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const patient = await findPatientIdBySub(sub);
    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const count = await deleteCondition(req.params.id, patient.id);
    if (!count) {
      res.status(404).json({ error: "Condition not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /me — soft-delete (7-year retention)
// ---------------------------------------------------------------------------
router.delete("/me", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const count = await softDeletePatient(sub);

    if (!count) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json({ message: "Deletion request recorded. Your data will be retained for 7 years per our retention policy." });
  } catch (err) {
    next(err);
  }
});

export default router;
