// PRD-008: Gemini Live session manager.
// Bridges a browser WebSocket to Gemini's BidiGenerateContent stream.
// One instance per active consultation session.

import WebSocket from "ws";
import { GoogleGenAI, Session, LiveServerMessage, Modality } from "@google/genai";
type GeminiErrorEvent = { message?: string };
import { config } from "../config";
import { detectRedFlag } from "./redFlagDetector";
import { getPatientPreContext, renderPreContextPrompt } from "./patientPreContext";
import { recordUsage } from "./llmUsageTracker";
import { pool } from "../db";
import { logger } from "../logger";
import { WsClientMessage, WsServerMessage } from "../types/ws-messages";

interface TranscriptTurn {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms: number;
}

const SYSTEM_PROMPT = `You are a clinical intake assistant for Nightingale, an Australian telehealth service.
Your role is to conduct a structured clinical history-taking interview with the patient.
Ask about their presenting complaint, symptom duration, severity, associated symptoms, relevant medical history, current medications, and allergies.
Be empathetic, clear, and thorough. Use plain language (Grade 8 reading level).
If the patient describes symptoms that may be an emergency (chest pain with breathing difficulty, stroke symptoms, severe allergic reaction, suicidal ideation, loss of consciousness, uncontrolled bleeding), respond with immediate care advice and ask them to call 000.
Never include disclaimers, caveats, or statements about the limits of your role. Do not tell the patient to see a doctor or that you cannot provide medical advice. The doctor review happens automatically after this call.`;

// ---------------------------------------------------------------------------
// GeminiLiveSession
// ---------------------------------------------------------------------------

export class GeminiLiveSession {
  private readonly consultationId: string;
  private readonly browserWs: WebSocket;
  private geminiSession: Session | null = null;
  private transcript: TranscriptTurn[] = [];
  private sessionStartedAt = Date.now();
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private ended = false;

  // Accumulate partial transcript text between `finished` markers
  private partialInput = "";
  private partialOutput = "";

  // Token usage accumulated across all server messages in this session
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(consultationId: string, browserWs: WebSocket) {
    this.consultationId = consultationId;
    this.browserWs = browserWs;
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

    // PRD-023 F-023: inject the anonymised patient baseline into the system
    // prompt at session start so the AI can skip basic identity questions and
    // tailor its opening turn to known allergies/meds/conditions.
    const preContextPrompt = renderPreContextPrompt(
      await getPatientPreContext(this.consultationId)
    );
    const systemInstruction = preContextPrompt
      ? `${SYSTEM_PROMPT}\n\n${preContextPrompt}`
      : SYSTEM_PROMPT;

    this.geminiSession = await ai.live.connect({
      model: config.gemini.model,
      config: {
        systemInstruction,
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          logger.info({ consultationId: this.consultationId }, "Gemini Live session opened");
          this.scheduleTimeout();
          this.updateConsultationStatus("active");
        },
        onmessage: (msg: LiveServerMessage) => {
          this.handleGeminiMessage(msg);
        },
        onerror: (e: GeminiErrorEvent) => {
          logger.error({ consultationId: this.consultationId, err: e.message }, "Gemini error");
          this.sendToBrowser({ type: "error", message: "Session error, please try again" });
          this.doEnd();
        },
        onclose: () => {
          logger.info({ consultationId: this.consultationId }, "Gemini Live session closed");
          if (!this.ended) this.doEnd();
        },
      },
    });

    // Handle browser WebSocket messages
    this.browserWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        this.handleBrowserMessage(msg);
      } catch {
        this.sendToBrowser({ type: "error", message: "Invalid message format" });
      }
    });

    this.browserWs.on("close", () => {
      this.doEnd();
    });
  }

  // ---------------------------------------------------------------------------
  // Browser → Gemini relay
  // ---------------------------------------------------------------------------

  private handleBrowserMessage(msg: WsClientMessage): void {
    if (this.ended || !this.geminiSession) return;

    switch (msg.type) {
      case "audio":
        if (msg.data) {
          this.geminiSession.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        }
        break;
      case "end":
        this.doEnd();
        break;
      default: {
        const _exhaustive: never = msg;
        throw new Error(`Unhandled client message type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gemini → Browser relay + red flag detection
  // ---------------------------------------------------------------------------

  private handleGeminiMessage(msg: LiveServerMessage): void {
    const usage = msg.usageMetadata as
      | { promptTokenCount?: number; responseTokenCount?: number; candidatesTokenCount?: number }
      | undefined;
    if (usage) {
      this.totalInputTokens += usage.promptTokenCount ?? 0;
      this.totalOutputTokens +=
        usage.responseTokenCount ?? usage.candidatesTokenCount ?? 0;
    }

    const content = msg.serverContent;
    if (!content) return;

    // Barge-in: user started speaking over the AI — signal browser to clear audio queue
    if (content.interrupted) {
      this.sendToBrowser({ type: "interrupted" });
      return;
    }

    // Relay audio chunks to browser
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.sendToBrowser({ type: "audio", data: part.inlineData.data });
        }
      }
    }

    // Patient speech transcription (input)
    if (content.inputTranscription?.text) {
      this.partialInput += content.inputTranscription.text;
      if (content.inputTranscription.finished) {
        const text = this.partialInput.trim();
        this.partialInput = "";
        if (text) this.addTranscriptTurn("patient", text);
      }
    }

    // AI speech transcription (output)
    if (content.outputTranscription?.text) {
      this.partialOutput += content.outputTranscription.text;
      if (content.outputTranscription.finished) {
        const text = this.partialOutput.trim();
        this.partialOutput = "";
        if (text) this.addTranscriptTurn("ai", text);
      }
    }
  }

  private addTranscriptTurn(speaker: "ai" | "patient", text: string): void {
    const timestamp_ms = Date.now() - this.sessionStartedAt;
    const turn: TranscriptTurn = { speaker, text, timestamp_ms };
    this.transcript.push(turn);

    this.sendToBrowser({ type: "transcript", speaker, text, timestamp_ms });

    // Run red flag detector on patient speech only
    if (speaker === "patient") {
      const result = detectRedFlag(text);
      if (result.triggered) {
        this.handleRedFlag(result.phrase);
      }
    }
  }

  private handleRedFlag(phrase: string): void {
    logger.warn({ consultationId: this.consultationId, phrase }, "Red flag detected");
    this.sendToBrowser({ type: "red_flag", phrase });
    this.sendToBrowser({
      type: "emergency",
      message:
        "This sounds like it could be a medical emergency. Please call 000 immediately or have someone take you to your nearest emergency department.",
    });

    // Update status and persist red flag audit entry
    pool
      .query(
        `UPDATE consultations
         SET status = 'emergency_escalated',
             red_flags = COALESCE(red_flags, '[]'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([{ phrase, detected_at: new Date().toISOString() }]), this.consultationId]
      )
      .catch((err) => logger.error({ err }, "Failed to persist red flag"));

    // Interrupt Gemini generation and close
    this.geminiSession?.close();
    this.doEnd();
  }

  // ---------------------------------------------------------------------------
  // Session end
  // ---------------------------------------------------------------------------

  private doEnd(): void {
    if (this.ended) return;
    this.ended = true;

    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.geminiSession?.close();

    // Flush any partial transcript turns that never received a `finished` marker
    if (this.partialInput.trim()) {
      this.addTranscriptTurn("patient", this.partialInput.trim());
      this.partialInput = "";
    }
    if (this.partialOutput.trim()) {
      this.addTranscriptTurn("ai", this.partialOutput.trim());
      this.partialOutput = "";
    }

    // Persist transcript
    pool
      .query(
        `UPDATE consultations
         SET status = 'transcript_ready',
             transcript = $1::jsonb,
             session_ended_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND status NOT IN ('emergency_escalated')`,
        [JSON.stringify(this.transcript), this.consultationId]
      )
      .catch((err) => logger.error({ err }, "Failed to persist transcript"));

    // One row per Live session — totals aggregated across all turns.
    if (this.totalInputTokens > 0 || this.totalOutputTokens > 0) {
      void recordUsage({
        consultationId: this.consultationId,
        operation: "live_session",
        provider: "google",
        modelId: config.gemini.model,
        inputTokens: this.totalInputTokens,
        outputTokens: this.totalOutputTokens,
        metadata: { sessionDurationMs: Date.now() - this.sessionStartedAt },
      });
    }

    this.sendToBrowser({ type: "ended", consultationId: this.consultationId });

    if (this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sendToBrowser(msg: WsServerMessage): void {
    if (this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.send(JSON.stringify(msg));
    }
  }

  private scheduleTimeout(): void {
    this.timeoutHandle = setTimeout(() => {
      logger.info({ consultationId: this.consultationId }, "Session timeout reached");
      this.doEnd();
    }, config.gemini.sessionTimeoutMs);
  }

  private updateConsultationStatus(status: string): void {
    pool
      .query(
        `UPDATE consultations
         SET status = $1, session_started_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [status, this.consultationId]
      )
      .catch((err) => logger.error({ err }, "Failed to update consultation status"));
  }
}
