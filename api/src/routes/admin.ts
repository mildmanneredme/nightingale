import { Router, RequestHandler } from "express";
import { createHash } from "crypto";
import { pool } from "../db";

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return (req as any).user.sub as string;
}

// Converts any string to a deterministic UUID v3-style using MD5.
// Admins don't have a DB row, so we derive a stable UUID from their cognito sub.
function subToUuid(sub: string): string {
  const h = createHash("md5").update(sub).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

// ---------------------------------------------------------------------------
// POST /consultations/:id/reassign
// ---------------------------------------------------------------------------
router.post("/consultations/:id/reassign", async (req, res, next) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      res.status(400).json({ error: "doctorId is required" });
      return;
    }

    // Verify doctor exists
    const { rows: doctorRows } = await pool.query(
      `SELECT id FROM doctors WHERE id = $1`,
      [doctorId]
    );
    if (!doctorRows[0]) {
      res.status(400).json({ error: "Doctor not found" });
      return;
    }

    // Fetch current assignment for audit log
    const { rows: consultRows } = await pool.query(
      `SELECT id, assigned_doctor_id FROM consultations WHERE id = $1`,
      [req.params.id]
    );
    if (!consultRows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    const previousDoctorId = consultRows[0].assigned_doctor_id;

    const { rows } = await pool.query(
      `UPDATE consultations
       SET assigned_doctor_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, assigned_doctor_id AS "assignedDoctorId"`,
      [doctorId, req.params.id]
    );

    const adminSub = cognitoSub(req);
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.reassigned', $1, 'admin', $2, $3)`,
      [
        subToUuid(adminSub),
        req.params.id,
        JSON.stringify({ doctorId, previousDoctorId, adminSub }),
      ]
    );

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
