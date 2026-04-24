import { Router, RequestHandler } from "express";
import { isEmail } from "validator";
import { pool } from "../db";

const router = Router();

const VALID_BIOLOGICAL_SEX = ["male", "female", "intersex", "prefer_not_to_say"];
const VALID_SEVERITY = ["mild", "moderate", "severe"];

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return (req as any).user.sub as string;
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
router.post("/register", async (req, res, next) => {
  try {
    const { email, privacyPolicyVersion } = req.body;

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    if (typeof email !== "string" || !isEmail(email)) {
      res.status(400).json({ error: "Invalid email address format" });
      return;
    }
    if (!privacyPolicyVersion) {
      res.status(400).json({ error: "privacyPolicyVersion is required" });
      return;
    }

    const sub = cognitoSub(req);

    const result = await pool.query(
      `INSERT INTO patients (cognito_sub, email, privacy_policy_accepted_at, privacy_policy_version)
       VALUES ($1, $2, NOW(), $3)
       RETURNING id, email`,
      [sub, email, privacyPolicyVersion]
    );

    res.status(201).json(result.rows[0]);
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

    const { rows } = await pool.query(
      `SELECT
         id, cognito_sub, email, full_name AS "fullName",
         date_of_birth AS "dateOfBirth", biological_sex AS "biologicalSex",
         phone, address, medicare_number AS "medicareNumber",
         ihi_number AS "ihiNumber",
         emergency_contact_name AS "emergencyContactName",
         emergency_contact_phone AS "emergencyContactPhone",
         emergency_contact_rel AS "emergencyContactRel",
         is_paediatric AS "isPaediatric",
         privacy_policy_accepted_at AS "privacyPolicyAcceptedAt",
         created_at AS "createdAt"
       FROM patients
       WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
      [sub]
    );

    if (!rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const patient = rows[0];

    const [allergies, medications, conditions] = await Promise.all([
      pool.query(
        `SELECT id, name, severity FROM patient_allergies WHERE patient_id = $1 ORDER BY created_at`,
        [patient.id]
      ),
      pool.query(
        `SELECT id, name, dose, frequency FROM patient_medications WHERE patient_id = $1 ORDER BY created_at`,
        [patient.id]
      ),
      pool.query(
        `SELECT id, name FROM patient_conditions WHERE patient_id = $1 ORDER BY created_at`,
        [patient.id]
      ),
    ]);

    res.json({
      ...patient,
      allergies: allergies.rows,
      medications: medications.rows,
      conditions: conditions.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /me
// ---------------------------------------------------------------------------
router.put("/me", async (req, res, next) => {
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
    } = req.body;

    if (biologicalSex !== undefined && !VALID_BIOLOGICAL_SEX.includes(biologicalSex)) {
      res.status(400).json({
        error: `biologicalSex must be one of: ${VALID_BIOLOGICAL_SEX.join(", ")}`,
      });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE patients SET
         full_name               = COALESCE($2, full_name),
         date_of_birth           = COALESCE($3, date_of_birth),
         biological_sex          = COALESCE($4, biological_sex),
         phone                   = COALESCE($5, phone),
         address                 = COALESCE($6, address),
         medicare_number         = COALESCE($7, medicare_number),
         ihi_number              = COALESCE($8, ihi_number),
         emergency_contact_name  = COALESCE($9, emergency_contact_name),
         emergency_contact_phone = COALESCE($10, emergency_contact_phone),
         emergency_contact_rel   = COALESCE($11, emergency_contact_rel)
       WHERE cognito_sub = $1 AND deletion_requested_at IS NULL
       RETURNING
         id, email,
         full_name AS "fullName",
         to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
         biological_sex AS "biologicalSex",
         phone, address`,
      [
        sub,
        fullName ?? null,
        dateOfBirth ?? null,
        biologicalSex ?? null,
        phone ?? null,
        address ?? null,
        medicareNumber ?? null,
        ihiNumber ?? null,
        emergencyContactName ?? null,
        emergencyContactPhone ?? null,
        emergencyContactRel ?? null,
      ]
    );

    if (!rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Allergies
// ---------------------------------------------------------------------------
router.post("/me/allergies", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name, severity } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!VALID_SEVERITY.includes(severity)) {
      res.status(400).json({
        error: `severity must be one of: ${VALID_SEVERITY.join(", ")}`,
      });
      return;
    }

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO patient_allergies (patient_id, name, severity)
       VALUES ($1, $2, $3)
       RETURNING id, name, severity`,
      [patient.rows[0].id, name, severity]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/allergies/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rowCount } = await pool.query(
      "DELETE FROM patient_allergies WHERE id = $1 AND patient_id = $2",
      [req.params.id, patient.rows[0].id]
    );

    if (!rowCount) {
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
router.post("/me/medications", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name, dose, frequency } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO patient_medications (patient_id, name, dose, frequency)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, dose, frequency`,
      [patient.rows[0].id, name, dose ?? null, frequency ?? null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/medications/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rowCount } = await pool.query(
      "DELETE FROM patient_medications WHERE id = $1 AND patient_id = $2",
      [req.params.id, patient.rows[0].id]
    );

    if (!rowCount) {
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
router.post("/me/conditions", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO patient_conditions (patient_id, name)
       VALUES ($1, $2)
       RETURNING id, name`,
      [patient.rows[0].id, name]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/me/conditions/:id", async (req, res, next) => {
  try {
    const sub = cognitoSub(req);

    const patient = await pool.query(
      "SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL",
      [sub]
    );
    if (!patient.rows.length) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rowCount } = await pool.query(
      "DELETE FROM patient_conditions WHERE id = $1 AND patient_id = $2",
      [req.params.id, patient.rows[0].id]
    );

    if (!rowCount) {
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

    const { rowCount } = await pool.query(
      `UPDATE patients SET deletion_requested_at = NOW()
       WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
      [sub]
    );

    if (!rowCount) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json({ message: "Deletion request recorded. Your data will be retained for 7 years per our retention policy." });
  } catch (err) {
    next(err);
  }
});

export default router;
