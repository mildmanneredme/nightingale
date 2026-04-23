import { Router, RequestHandler } from "express";
import WebSocket from "ws";
import { pool } from "../db";
import { GeminiLiveSession } from "../services/geminiLive";

// Called from index.ts WebSocket upgrade handler (no Express auth middleware here —
// the consultation ID acts as an unguessable session token; Cognito auth over WS
// is deferred to a follow-up PR when we add WS-level token validation).
export function attachConsultationStream(
  consultationId: string,
  ws: WebSocket
): void {
  const session = new GeminiLiveSession(consultationId, ws);
  session.start().catch((err) => {
    ws.send(JSON.stringify({ type: "error", message: "Failed to start session" }));
    ws.close();
  });
}

const router = Router();

const VALID_CONSULTATION_TYPES = ["voice", "text"];

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return (req as any).user.sub as string;
}

async function getPatientId(sub: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM patients WHERE cognito_sub = $1 AND deletion_requested_at IS NULL`,
    [sub]
  );
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------
router.post("/", async (req, res, next) => {
  try {
    const { consultationType, presentingComplaint } = req.body;

    if (!consultationType) {
      res.status(400).json({ error: "consultationType is required" });
      return;
    }
    if (!VALID_CONSULTATION_TYPES.includes(consultationType)) {
      res.status(400).json({
        error: `consultationType must be one of: ${VALID_CONSULTATION_TYPES.join(", ")}`,
      });
      return;
    }

    const patientId = await getPatientId(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO consultations (patient_id, consultation_type, presenting_complaint)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         status,
         consultation_type AS "consultationType",
         presenting_complaint AS "presentingComplaint",
         created_at AS "createdAt"`,
      [patientId, consultationType, presentingComplaint ?? null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    const patientId = await getPatientId(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         status,
         consultation_type AS "consultationType",
         presenting_complaint AS "presentingComplaint",
         created_at AS "createdAt",
         session_started_at AS "sessionStartedAt",
         session_ended_at AS "sessionEndedAt"
       FROM consultations
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const patientId = await getPatientId(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         status,
         consultation_type AS "consultationType",
         presenting_complaint AS "presentingComplaint",
         transcript,
         red_flags AS "redFlags",
         created_at AS "createdAt",
         session_started_at AS "sessionStartedAt",
         session_ended_at AS "sessionEndedAt"
       FROM consultations
       WHERE id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/end
// ---------------------------------------------------------------------------
router.post("/:id/end", async (req, res, next) => {
  try {
    const patientId = await getPatientId(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { transcript } = req.body;

    const { rows } = await pool.query(
      `UPDATE consultations
       SET
         status = 'transcript_ready',
         transcript = $1,
         session_ended_at = NOW(),
         updated_at = NOW()
       WHERE id = $2 AND patient_id = $3
       RETURNING
         id,
         status,
         consultation_type AS "consultationType",
         transcript,
         session_ended_at AS "sessionEndedAt"`,
      [JSON.stringify(transcript ?? []), req.params.id, patientId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
