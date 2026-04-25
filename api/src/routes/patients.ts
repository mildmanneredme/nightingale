import { Router, RequestHandler } from "express";
import { validateBody } from "../middleware/validate";
import {
  RegisterPatientSchema,
  UpdatePatientSchema,
  AddAllergySchema,
  AddMedicationSchema,
  AddConditionSchema,
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
} from "../repositories/patient.repository";

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

    res.json({
      ...patient,
      allergies,
      medications,
      conditions,
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
    const {
      fullName,
      dateOfBirth,
      biologicalSex,
      phone,
      address,
      medicareNumber,
      ihiNumber,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRel,
      guardianName,
      guardianEmail,
      guardianRelationship,
    } = req.body;

    const row = await updatePatient(sub, {
      fullName,
      dateOfBirth,
      biologicalSex,
      phone,
      address,
      medicareNumber,
      ihiNumber,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRel,
      guardianName,
      guardianEmail,
      guardianRelationship,
    });

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
