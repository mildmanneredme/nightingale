import { Router, RequestHandler } from "express";
import { z } from "zod";
import WebSocket from "ws";
import PDFDocument from "pdfkit";
import { logger } from "../logger";
import { GeminiLiveSession } from "../services/geminiLive";
import { WsServerMessage } from "../types/ws-messages";
import { sendTextMessage, TextTurn } from "../services/textConsultation";
import { getPatientPreContext, renderPreContextPrompt } from "../services/patientPreContext";
import { runEngine } from "../services/clinicalAiEngine";
import { getResponseTimeEstimate } from "./availability";
import { validateBody } from "../middleware/validate";
import {
  CreateConsultationSchema,
  EndConsultationSchema,
  ChatMessageSchema,
} from "../schemas/consultation.schema";
import {
  findPatientIdBySub,
  findExistingConsultationByIdempotencyKey,
  insertConsultation,
  countConsultationsByPatient,
  listConsultationsByPatient,
  findConsultationByIdAndPatient,
  endConsultation,
  findConsultationForChat,
  updateConsultationChat,
  setConsultationAiFailed,
  findConsultationForPdf,
  insertPdfAuditLog,
  findConsultationOwnership,
  insertWsToken,
} from "../repositories/consultation.repository";

// Fire-and-forget engine trigger. Errors are logged but never bubble to the
// HTTP response — the patient's consultation end is acknowledged immediately.
// F-029/F-030: If runEngine throws (e.g. PII abort, DB failure before retry loop),
// update consultation.status to 'ai_failed' and log at error level.
function triggerEngine(consultationId: string): void {
  setImmediate(() => {
    runEngine(consultationId).catch(async (err) => {
      logger.error({ err, consultationId }, "consultations: clinical AI engine failed — setting ai_failed");
      try {
        await setConsultationAiFailed(consultationId);
      } catch (dbErr) {
        logger.error({ dbErr, consultationId }, "consultations: failed to set ai_failed status");
      }
    });
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
    const errorMsg: WsServerMessage = { type: "error", message: "Failed to start session" };
    ws.send(JSON.stringify(errorMsg));
    ws.close();
  });
}

const router = Router();

function cognitoSub(req: Parameters<RequestHandler>[0]): string {
  return req.user.sub;
}

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------
router.post("/", validateBody(CreateConsultationSchema), async (req, res, next) => {
  try {
    const { consultationType, presentingComplaint } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    // SEC-003: Idempotency — return existing consultation if same key used within 24h
    if (idempotencyKey) {
      const existing = await findExistingConsultationByIdempotencyKey(patientId, idempotencyKey);
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }

    const row = await insertConsultation(patientId, consultationType, presentingComplaint ?? null, idempotencyKey ?? null);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------
router.get("/", async (req, res, next) => {
  try {
    if (Array.isArray(req.query.limit) || Array.isArray(req.query.offset)) {
      res.status(400).json({ error: "limit and offset must be single values" });
      return;
    }

    const rawLimit = parseInt(req.query.limit as string);
    const rawOffset = parseInt(req.query.offset as string);

    if (!isNaN(rawLimit) && (rawLimit < 1 || rawLimit > 100)) {
      res.status(400).json({ error: "limit must be between 1 and 100" });
      return;
    }

    const limit = Math.min(!isNaN(rawLimit) ? rawLimit : 20, 100);
    const offset = Math.max(0, !isNaN(rawOffset) ? rawOffset : 0);

    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const [total, rows] = await Promise.all([
      countConsultationsByPatient(patientId),
      listConsultationsByPatient(patientId, limit, offset),
    ]);

    res.status(200).json({
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res, next) => {
  try {
    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const row = await findConsultationByIdAndPatient(req.params.id, patientId);
    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/end
// ---------------------------------------------------------------------------
router.post("/:id/end", validateBody(EndConsultationSchema), async (req, res, next) => {
  try {
    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const { transcript } = req.body;
    const row = await endConsultation(req.params.id, patientId, transcript);

    if (!row) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    // Trigger the clinical AI engine in the background
    triggerEngine(row.id);

    res.status(200).json(row);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/chat — turn-by-turn text consultation
// ---------------------------------------------------------------------------
router.post("/:id/chat", validateBody(ChatMessageSchema), async (req, res, next) => {
  try {
    const { message } = req.body;

    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const consultation = await findConsultationForChat(req.params.id, patientId);
    if (!consultation || consultation.consultation_type !== "text") {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }
    if (!["pending", "active"].includes(consultation.status)) {
      res.status(409).json({ error: "Consultation is not active" });
      return;
    }

    const history: TextTurn[] = (consultation.transcript as TextTurn[]) ?? [];
    const patientTurn: TextTurn = {
      speaker: "patient",
      text: message.trim(),
      timestamp_ms: Date.now(),
    };

    // PRD-023 F-022: inject the patient baseline into the system prompt only
    // on the first turn — once history exists Gemini already has the context.
    const preContextPrompt = history.length === 0
      ? renderPreContextPrompt(await getPatientPreContext(req.params.id))
      : undefined;
    const aiResponse = await sendTextMessage(message.trim(), history, preContextPrompt, req.params.id);

    const aiTurn: TextTurn = {
      speaker: "ai",
      text: aiResponse.text ?? aiResponse.message ?? aiResponse.summary ?? "",
      timestamp_ms: Date.now(),
    };
    const finalHistory = [...history, patientTurn, aiTurn];

    let newStatus = consultation.status === "pending" ? "active" : consultation.status;
    if (aiResponse.type === "emergency") newStatus = "emergency_escalated";
    if (aiResponse.type === "complete") newStatus = "transcript_ready";

    await updateConsultationChat(req.params.id, newStatus, finalHistory);

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
    const patientSub = req.user.sub;
    const row = await findConsultationForPdf(req.params.id);

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
    insertPdfAuditLog(row.patient_id, row.id, row.id).catch((err) =>
      logger.error({ err, consultationId: row.id }, "Failed to log PDF download")
    );
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/consultations/:id/stream-token  (SEC-004)
// Issues a single-use, 2-minute WebSocket session token for voice stream auth.
// Prevents the consultation UUID being used as a session credential.
// ---------------------------------------------------------------------------
router.post("/:id/stream-token", validateBody(z.object({})), async (req, res, next) => {
  try {
    const { id: consultationId } = req.params;
    const { randomUUID } = await import("crypto");

    const patientId = await findPatientIdBySub(cognitoSub(req));
    if (!patientId) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    // Verify the consultation belongs to this patient
    const owned = await findConsultationOwnership(consultationId, patientId);
    if (!owned) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const wsToken = randomUUID();
    await insertWsToken(wsToken, consultationId, patientId);

    res.status(201).json({ wsToken, expiresInSeconds: 120 });
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
