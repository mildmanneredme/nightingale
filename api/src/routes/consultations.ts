import { Router, RequestHandler } from "express";
import WebSocket from "ws";
import PDFDocument from "pdfkit";
import { pool } from "../db";
import { logger } from "../logger";
import { GeminiLiveSession } from "../services/geminiLive";
import { sendTextMessage, TextTurn } from "../services/textConsultation";
import { runEngine } from "../services/clinicalAiEngine";
import { getResponseTimeEstimate } from "./availability";

// Fire-and-forget engine trigger. Errors are logged but never bubble to the
// HTTP response — the patient's consultation end is acknowledged immediately.
function triggerEngine(consultationId: string): void {
  runEngine(consultationId).catch((err) => {
    logger.error({ err, consultationId }, "consultations: clinical AI engine failed");
  });
}

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

    // Trigger the clinical AI engine in the background
    triggerEngine(rows[0].id);

    res.status(200).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/chat — turn-by-turn text consultation
// ---------------------------------------------------------------------------
router.post("/:id/chat", async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const patientId = await getPatientId(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, status, consultation_type, transcript
       FROM consultations
       WHERE id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );
    const consultation = rows[0];
    if (!consultation || consultation.consultation_type !== "text") {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    if (!["pending", "active"].includes(consultation.status)) {
      res.status(409).json({ error: "Consultation is not active" });
      return;
    }

    const history: TextTurn[] = consultation.transcript ?? [];
    const patientTurn: TextTurn = {
      speaker: "patient",
      text: message.trim(),
      timestamp_ms: Date.now(),
    };

    const aiResponse = await sendTextMessage(message.trim(), history);

    const aiTurn: TextTurn = {
      speaker: "ai",
      text: aiResponse.text ?? aiResponse.message ?? aiResponse.summary ?? "",
      timestamp_ms: Date.now(),
    };
    const finalHistory = [...history, patientTurn, aiTurn];

    let newStatus = consultation.status === "pending" ? "active" : consultation.status;
    if (aiResponse.type === "emergency") newStatus = "emergency_escalated";
    if (aiResponse.type === "complete") newStatus = "transcript_ready";

    await pool.query(
      `UPDATE consultations
       SET status = $1,
           transcript = $2,
           session_started_at = CASE WHEN session_started_at IS NULL THEN NOW() ELSE session_started_at END,
           session_ended_at = CASE WHEN $1 IN ('transcript_ready', 'emergency_escalated') THEN NOW() ELSE session_ended_at END,
           updated_at = NOW()
       WHERE id = $3`,
      [newStatus, JSON.stringify(finalHistory), req.params.id]
    );

    // Trigger the clinical AI engine when the text consultation reaches transcript_ready
    if (newStatus === "transcript_ready") {
      triggerEngine(req.params.id);
    }

    res.status(200).json({
      consultationId: req.params.id,
      aiResponse,
      status: newStatus,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations/:id/pdf  (patient — authenticated)
// Streams a clinical assessment PDF summary. Only available for approved/amended.
// Generated in-memory; never stored on server.
// ---------------------------------------------------------------------------
router.get("/:id/pdf", async (req, res, next) => {
  try {
    const patientSub = (req as any).user?.sub as string | undefined;
    const { rows } = await pool.query<{
      id: string;
      presenting_complaint: string;
      status: string;
      reviewed_at: Date | null;
      doctor_draft: string | null;
      ai_draft: string | null;
      doctor_first_name: string;
      doctor_last_name: string;
      ahpra_number: string;
      patient_id: string;
      patient_cognito_sub: string;
    }>(
      `SELECT c.id, c.presenting_complaint, c.status, c.reviewed_at,
              c.doctor_draft, c.ai_draft,
              d.first_name AS doctor_first_name, d.last_name AS doctor_last_name,
              d.ahpra_number,
              p.id AS patient_id, p.cognito_sub AS patient_cognito_sub
       FROM consultations c
       JOIN doctors d  ON d.id = c.reviewed_by
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    if (row.patient_cognito_sub !== patientSub) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!["approved", "amended"].includes(row.status)) {
      res.status(400).json({ error: "PDF only available for approved or amended consultations" });
      return;
    }

    const responseText = row.doctor_draft ?? row.ai_draft ?? "";
    const doctorName = `Dr ${row.doctor_first_name} ${row.doctor_last_name}`;
    const reviewedDate = row.reviewed_at
      ? row.reviewed_at.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
      : "Unknown";

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nightingale-consultation-${row.id.slice(0, 8)}.pdf"`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text("Clinical Assessment Summary", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text("Nightingale Health Pty Ltd", { align: "center" });
    doc.moveDown(1.5);

    // Consultation details
    doc.fontSize(12).font("Helvetica-Bold").text("Consultation Details");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Date reviewed: ${reviewedDate}`);
    doc.text(`Chief complaint: ${row.presenting_complaint}`);
    doc.text(`Status: ${row.status}`);
    doc.moveDown(1);

    // Clinical response
    doc.fontSize(12).font("Helvetica-Bold").text("Doctor's Assessment");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").text(responseText, { lineGap: 3 });
    doc.moveDown(1.5);

    // AHPRA footer
    doc.fontSize(9).font("Helvetica").fillColor("#555555");
    doc.text(
      `Reviewed and approved by ${doctorName}  |  AHPRA Registration: ${row.ahpra_number}  |  ${reviewedDate}`,
      { align: "center" }
    );
    doc.moveDown(0.5);
    doc.text(
      "This document is a clinical assessment summary, not a formal prescription. " +
      "This advice is not a substitute for in-person medical care. " +
      "If your condition worsens, seek urgent care or call 000.",
      { align: "center" }
    );

    doc.end();

    // Audit log (fire-and-forget — streaming has already started)
    pool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.pdf_downloaded', $1, 'patient', $2, $3)`,
      [row.patient_id, row.id, JSON.stringify({ doctor_id: row.id })]
    ).catch((err) => logger.error({ err, consultationId: row.id }, "Failed to log PDF download"));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/consultations/response-time
// Patient-facing estimated response time (no auth required — called before login).
// ---------------------------------------------------------------------------
router.get("/response-time", async (_req, res, next) => {
  try {
    const estimate = await getResponseTimeEstimate();
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

export default router;
