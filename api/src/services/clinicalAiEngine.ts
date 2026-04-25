// PRD-012: Clinical AI Engine
//
// Processes a completed consultation transcript to produce three outputs for
// the doctor review queue:
//   1. SOAP note (structured clinical summary for GP review)
//   2. Differential diagnosis list (ranked, with likelihood percentages)
//   3. Draft patient response (plain English, awaiting GP approval)
//
// HITL invariant: nothing produced here reaches a patient without a doctor's
// approval. The engine writes to the DB and transitions status to
// 'queued_for_review'. The notification layer (PRD-014) gates on
// doctor_approved_at being set.
//
// Status: DRAFT — system prompts pending Medical Director sign-off.
// Flags are deterministic (no LLM involvement).
//
// Model version and prompt hash are logged to audit trail on every invocation.

import { createHash } from "crypto";
import { Pool } from "pg";
import { pool as defaultPool } from "../db";
import { logger } from "../logger";
import { retrieve as ragRetrieve } from "./rag";
import {
  anonymiseTranscript,
  buildAnonymisedPatientContext,
  isPiiClean,
  type TranscriptTurn,
  type PatientProfile,
} from "./piiAnonymiser";
import { callClaude } from "./anthropicClient";
import { config } from "../config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  redFlagsDetected: string[];
}

export interface Differential {
  condition: string;
  likelihoodPct: number;
  rationale: string;
  confidence: "high" | "medium" | "low";
}

export interface EngineOutput {
  soapNote: SoapNote;
  differentials: Differential[];
  draftResponse: string;
  cannotAssess: boolean;
  cannotAssessReason: string | null;
}

export type PriorityFlag =
  | "LOW_CONFIDENCE"
  | "INCOMPLETE_INTERVIEW"
  | "PEDIATRIC"
  | "CHRONIC_CARE"
  | "POOR_PHOTO"
  | "CANNOT_ASSESS";

// ---------------------------------------------------------------------------
// Cannot-assess criteria (Medical Director to approve before production)
// ---------------------------------------------------------------------------
const CANNOT_ASSESS_PATTERNS = [
  /acute abdomen/i,
  /abdominal (rigidity|guarding|tenderness)/i,
  /\btrauma\b/i,
  /significant (injury|injuries|wound)/i,
  /acute vision (loss|change|changes)/i,
  /sudden (blindness|loss of sight)/i,
  /auscultation required/i,
  /physical examination required/i,
  /\bsigns of stroke\b/i,
  /cauda equina/i,
];

const CANNOT_ASSESS_TEMPLATE = `Thank you for using Nightingale.

After reviewing the information you've provided, the doctor has determined that your presentation requires an in-person examination to be safely assessed. This is not something that can be appropriately managed through a remote telehealth consultation at this time.

**What you should do:**
- See your GP or visit a medical centre as soon as possible
- If your symptoms are severe or worsening, call 000 or go to your nearest emergency department

**Healthdirect** can also help you find the right care: call **1800 022 222** (free, 24/7).

A full refund will be processed for this consultation.

This advice is not a substitute for in-person medical care. If you have any concerns about your symptoms, please contact a healthcare professional immediately.`;

// ---------------------------------------------------------------------------
// System prompt (static — cached by Anthropic prompt caching)
// ---------------------------------------------------------------------------

const AHPRA_CONSTRAINTS = `## AHPRA Advertising Compliance — MANDATORY
- Use "assess" — NEVER "diagnose"
- Use "recommend" — NEVER "prescribe" in patient-facing text
- Use "may indicate" or "is consistent with" — NEVER "you have [condition]"
- Emergency services: always "000" — NEVER "911"
- Always include in patient-facing drafts: "This advice is not a substitute for in-person medical care"
- Prohibited: medication brand names (unless PBS-listed), off-label uses, claims of diagnostic certainty, references to US/UK systems
- Status: DRAFT — pending Medical Director and AHPRA advertising compliance reviewer sign-off`;

const CANNOT_ASSESS_CRITERIA = `## Cannot-Assess Criteria (Medical Director pending sign-off)
Set cannot_assess: true if the presentation involves ANY of:
- Suspected acute abdomen, abdominal rigidity, guarding, or localised tenderness with fever
- Significant trauma, injury, or wound requiring physical inspection
- Acute vision changes or sudden loss of sight
- Signs of stroke (FAST: facial droop, arm weakness, slurred speech)
- Cauda equina syndrome (saddle anaesthesia, bilateral leg weakness, loss of bladder/bowel control)
- Any presentation where physical examination (auscultation, palpation, percussion) is essential for safe assessment
- Active suicidal ideation with intent or plan (escalate to 000 rather than cannot_assess)`;

const OUTPUT_SCHEMA = `## Required Output Format

Respond with ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no preamble.

{
  "soap_note": {
    "subjective": "string — patient-reported symptoms, history, onset, duration, severity, associated symptoms, relevant medications and allergies. Use direct quotes where appropriate. Max 400 words.",
    "objective": "string — objective observations from transcript and photos. Always include: 'No in-person examination performed.' Note any vital signs or observations the patient reported. Max 200 words.",
    "assessment": "string — clinical impression using differential language ('may be consistent with', 'findings suggest'). Reference retrieved guidelines. Flag any red flags prominently. Max 200 words.",
    "plan": "string — recommended management for GP consideration: self-care options, conditions for seeking further care (including 000 triggers), follow-up recommendations, prescribing considerations (GP to determine). Max 200 words.",
    "red_flags_detected": ["array of strings — any emergency or urgent features identified, empty array if none"]
  },
  "differentials": [
    {
      "condition": "string — condition name using SNOMED CT-AU preferred term where available",
      "likelihood_pct": number,
      "rationale": "string — 1-2 sentences: supporting features and features against",
      "confidence": "high | medium | low"
    }
  ],
  "draft_response": "string — plain English patient-facing response for GP review. Max 400 words. Must include when to seek further care and emergency triggers. Must end with: 'This advice is not a substitute for in-person medical care.'",
  "cannot_assess": boolean,
  "cannot_assess_reason": "string | null — brief reason if cannot_assess is true, null otherwise"
}

Rules for differentials:
- Minimum 2, maximum 5 entries
- likelihood_pct values must sum to exactly 100
- Sort by likelihood_pct descending
- confidence: "high" if likelihood_pct >= 60, "medium" if 20-59, "low" if < 20
- Use Australian medication names and PBS-listed drugs only

If cannot_assess is true: set draft_response to an empty string.`;

function buildSystemPrompt(ragContext: string): string {
  return `You are a clinical decision support AI for Nightingale, an Australian telehealth platform.
You assist credentialed Australian GPs by processing patient consultation transcripts into structured clinical outputs.
All outputs are reviewed and approved by a GP before any patient communication.

${AHPRA_CONSTRAINTS}

${CANNOT_ASSESS_CRITERIA}

## Retrieved Australian Clinical Guidelines
${ragContext || "No specific guidelines retrieved for this presentation."}

${OUTPUT_SCHEMA}`;
}

// ---------------------------------------------------------------------------
// parseEngineOutput
// Extracts and validates the structured JSON from the LLM response.
// ---------------------------------------------------------------------------
function parseEngineOutput(raw: string): EngineOutput {
  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Engine output is not valid JSON: ${cleaned.slice(0, 200)}`);
  }

  // Validate soap_note
  const sn = parsed.soap_note as Record<string, unknown> | undefined;
  if (!sn || typeof sn !== "object") throw new Error("Missing soap_note");
  for (const key of ["subjective", "objective", "assessment", "plan"]) {
    if (typeof sn[key] !== "string" || !sn[key]) {
      throw new Error(`soap_note.${key} is missing or empty`);
    }
  }

  // Validate differentials
  const diffs = parsed.differentials as unknown[];
  if (!Array.isArray(diffs) || diffs.length < 2 || diffs.length > 5) {
    throw new Error(
      `differentials must be an array of 2–5 items, got ${Array.isArray(diffs) ? diffs.length : typeof diffs}`
    );
  }
  const totalPct = (diffs as Record<string, unknown>[]).reduce(
    (sum: number, d) => sum + (Number(d.likelihood_pct) || 0),
    0
  );
  if (Math.abs(totalPct - 100) > 5) {
    throw new Error(`differentials likelihood_pct must sum to ~100, got ${totalPct}`);
  }

  if (typeof parsed.draft_response !== "string") {
    throw new Error("draft_response is missing");
  }

  const soapNote: SoapNote = {
    subjective: String(sn.subjective),
    objective: String(sn.objective),
    assessment: String(sn.assessment),
    plan: String(sn.plan),
    redFlagsDetected: Array.isArray(sn.red_flags_detected)
      ? (sn.red_flags_detected as string[])
      : [],
  };

  const differentials: Differential[] = diffs.map((d) => {
    const item = d as Record<string, unknown>;
    const pct = Number(item.likelihood_pct);
    return {
      condition: String(item.condition),
      likelihoodPct: pct,
      rationale: String(item.rationale),
      confidence: pct >= 60 ? "high" : pct >= 20 ? "medium" : "low",
    };
  });

  return {
    soapNote,
    differentials,
    draftResponse: String(parsed.draft_response),
    cannotAssess: Boolean(parsed.cannot_assess),
    cannotAssessReason:
      parsed.cannot_assess_reason != null ? String(parsed.cannot_assess_reason) : null,
  };
}

// ---------------------------------------------------------------------------
// computeFlags — deterministic, rule-based (no LLM involvement, per PRD F-027)
// ---------------------------------------------------------------------------
interface ConsultationForFlags {
  transcript: TranscriptTurn[] | null;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  isPaediatric: boolean;
  hasConditions: boolean;
  hasQualityOverriddenPhotos: boolean;
  engineOutput: EngineOutput;
}

export function computeFlags(c: ConsultationForFlags): PriorityFlag[] {
  const flags: PriorityFlag[] = [];

  // LOW_CONFIDENCE: top differential < 50%
  const topLikelihood = c.engineOutput.differentials[0]?.likelihoodPct ?? 0;
  if (topLikelihood < 50) flags.push("LOW_CONFIDENCE");

  // INCOMPLETE_INTERVIEW: < 3 patient turns in transcript
  const patientTurns = (c.transcript ?? []).filter((t) => t.speaker === "patient").length;
  let durationTooShort = false;
  if (c.sessionStartedAt && c.sessionEndedAt) {
    const durationMs =
      new Date(c.sessionEndedAt).getTime() - new Date(c.sessionStartedAt).getTime();
    durationTooShort = durationMs < 3 * 60 * 1000;
  }
  if (patientTurns < 3 || durationTooShort) flags.push("INCOMPLETE_INTERVIEW");

  if (c.isPaediatric) flags.push("PEDIATRIC");
  if (c.hasConditions) flags.push("CHRONIC_CARE");
  if (c.hasQualityOverriddenPhotos) flags.push("POOR_PHOTO");
  if (c.engineOutput.cannotAssess) flags.push("CANNOT_ASSESS");

  return flags;
}

// ---------------------------------------------------------------------------
// checkCannotAssessPresentation
// Pre-screens the transcript for cannot-assess patterns before calling the LLM.
// Used as an additional deterministic safety check.
// ---------------------------------------------------------------------------
function detectCannotAssessSignals(transcriptText: string): boolean {
  return CANNOT_ASSESS_PATTERNS.some((p) => p.test(transcriptText));
}

// ---------------------------------------------------------------------------
// withRetry — exponential backoff helper (F-031)
// Retries fn up to `retries` additional times (total attempts = retries + 1).
// Delays: delayMs, delayMs*2, delayMs*4, ...
// ---------------------------------------------------------------------------
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number
): Promise<T> {
  let lastError: Error = new Error("No attempts made");
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// runEngine — main exported function
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;

export async function runEngine(
  consultationId: string,
  dbPool: Pool = defaultPool
): Promise<void> {
  const modelId = config.anthropic.useBedrock
    ? config.anthropic.bedrockModelId
    : config.anthropic.directModelId;

  logger.info({ consultationId, modelId }, "clinicalAiEngine: starting");

  // -------------------------------------------------------------------------
  // 1. Fetch consultation + patient profile + photo flags
  // -------------------------------------------------------------------------
  const { rows: consultRows } = await dbPool.query(
    `SELECT
       c.id,
       c.status,
       c.consultation_type,
       c.presenting_complaint,
       c.transcript,
       c.red_flags,
       c.session_started_at,
       c.session_ended_at,
       p.date_of_birth,
       p.biological_sex,
       p.is_paediatric,
       (SELECT COUNT(*) FROM patient_allergies WHERE patient_id = p.id) AS allergy_count,
       (SELECT COUNT(*) FROM patient_medications WHERE patient_id = p.id) AS medication_count,
       (SELECT COUNT(*) FROM patient_conditions WHERE patient_id = p.id) AS condition_count,
       (SELECT json_agg(json_build_object('name', name, 'severity', severity)) FROM patient_allergies WHERE patient_id = p.id) AS allergies,
       (SELECT json_agg(json_build_object('name', name, 'dose', dose, 'frequency', frequency)) FROM patient_medications WHERE patient_id = p.id) AS medications,
       (SELECT json_agg(json_build_object('name', name)) FROM patient_conditions WHERE patient_id = p.id) AS conditions
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.id = $1`,
    [consultationId]
  );

  const consult = consultRows[0];
  if (!consult) {
    throw new Error(`Consultation ${consultationId} not found`);
  }
  if (consult.status !== "transcript_ready") {
    logger.warn(
      { consultationId, status: consult.status },
      "clinicalAiEngine: consultation not in transcript_ready status, skipping"
    );
    return;
  }

  // Check if any photos were uploaded with quality override
  const { rows: photoRows } = await dbPool.query(
    `SELECT COUNT(*) AS count FROM consultation_photos
     WHERE consultation_id = $1 AND quality_overridden = true`,
    [consultationId]
  );
  const hasQualityOverriddenPhotos = parseInt(photoRows[0].count, 10) > 0;

  // -------------------------------------------------------------------------
  // 2. Anonymise PII from transcript
  // -------------------------------------------------------------------------
  const transcript: TranscriptTurn[] = consult.transcript ?? [];
  const anonymisedTranscript = anonymiseTranscript(transcript);

  const patientProfile: PatientProfile = {
    dateOfBirth: consult.date_of_birth,
    biologicalSex: consult.biological_sex,
    isPaediatric: consult.is_paediatric,
    allergies: consult.allergies ?? [],
    medications: consult.medications ?? [],
    conditions: consult.conditions ?? [],
  };
  const anonymisedPatientContext = buildAnonymisedPatientContext(patientProfile);

  // -------------------------------------------------------------------------
  // 3. PII clean check — automated assertion (PRD F-004)
  // -------------------------------------------------------------------------
  const fullPayload = anonymisedTranscript + "\n" + anonymisedPatientContext;
  const piiCheck = isPiiClean(fullPayload);
  if (!piiCheck.clean) {
    logger.error(
      { consultationId, violations: piiCheck.violations },
      "clinicalAiEngine: PII detected in payload — aborting to protect patient privacy"
    );
    throw new Error(
      `PII detected in LLM payload for consultation ${consultationId}: ${piiCheck.violations.join(", ")}`
    );
  }

  // -------------------------------------------------------------------------
  // 4. Retrieve RAG context
  // -------------------------------------------------------------------------
  let ragContext = "";
  try {
    const ragResult = await ragRetrieve(
      consult.presenting_complaint ?? "",
      { topK: 5, consultationId },
      dbPool
    );
    ragContext = ragResult.chunks.map((c) => `### ${c.sourceName}\n${c.chunkText}`).join("\n\n");
  } catch (err) {
    logger.warn({ err, consultationId }, "clinicalAiEngine: RAG retrieval failed, continuing without context");
  }

  // -------------------------------------------------------------------------
  // 5. Build prompt
  // -------------------------------------------------------------------------
  const systemPrompt = buildSystemPrompt(ragContext);
  const promptHash = createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16);

  const transcriptText = transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n");
  const preScreenCannotAssess = detectCannotAssessSignals(transcriptText);

  const userMessage = `## Patient Context (anonymised)
${anonymisedPatientContext}

## Presenting Complaint
${consult.presenting_complaint ?? "Not specified"}

## Consultation Transcript (anonymised)
${anonymisedTranscript}

${preScreenCannotAssess ? "## Note\nPre-screen detected possible cannot-assess signals. Review carefully.\n" : ""}
Please generate the clinical outputs as specified.`;

  // -------------------------------------------------------------------------
  // 6. Call Claude with retries
  // -------------------------------------------------------------------------
  let engineOutput: EngineOutput | null = null;
  let lastError: Error | null = null;

  const RETRY_BASE_DELAY_MS = 1000; // 1s, 2s, 4s for attempts 0, 1, 2

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callClaude(systemPrompt, [
        { role: "user", content: userMessage },
      ]);

      engineOutput = parseEngineOutput(response.content);

      logger.info(
        {
          consultationId,
          attempt,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          cacheReadTokens: response.cacheReadTokens,
        },
        "clinicalAiEngine: engine output generated"
      );
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { consultationId, attempt, err: lastError.message },
        "clinicalAiEngine: attempt failed, retrying"
      );
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s after attempt 0, 2s after attempt 1
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }
  }

  if (!engineOutput) {
    // All retries exhausted — flag for manual triage
    await flagManualTriage(consultationId, lastError?.message ?? "unknown", dbPool);
    return;
  }

  // -------------------------------------------------------------------------
  // 7. Override draft for cannot-assess cases
  // -------------------------------------------------------------------------
  if (engineOutput.cannotAssess) {
    engineOutput.draftResponse = CANNOT_ASSESS_TEMPLATE;
  }

  // -------------------------------------------------------------------------
  // 8. Compute deterministic priority flags
  // -------------------------------------------------------------------------
  const flags = computeFlags({
    transcript,
    sessionStartedAt: consult.session_started_at,
    sessionEndedAt: consult.session_ended_at,
    isPaediatric: consult.is_paediatric,
    hasConditions: parseInt(consult.condition_count, 10) > 0,
    hasQualityOverriddenPhotos,
    engineOutput,
  });

  // -------------------------------------------------------------------------
  // 9. Persist results and transition to queued_for_review
  // -------------------------------------------------------------------------
  await dbPool.query(
    `UPDATE consultations
     SET
       soap_note            = $1,
       differential_diagnoses = $2,
       ai_draft             = $3,
       priority_flags       = $4,
       status               = CASE
         WHEN $5 THEN 'cannot_assess'
         ELSE 'queued_for_review'
       END,
       updated_at           = NOW()
     WHERE id = $6`,
    [
      JSON.stringify(engineOutput.soapNote),
      JSON.stringify(engineOutput.differentials),
      engineOutput.draftResponse,
      flags,
      engineOutput.cannotAssess,
      consultationId,
    ]
  );

  // -------------------------------------------------------------------------
  // 10. Audit log
  // -------------------------------------------------------------------------
  try {
    await dbPool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.ai_output_generated', $1, 'system', $2, $3)`,
      [
        "00000000-0000-0000-0000-000000000000",
        consultationId,
        JSON.stringify({
          modelId,
          promptHash,
          flags,
          cannotAssess: engineOutput.cannotAssess,
          differentialCount: engineOutput.differentials.length,
          topLikelihoodPct: engineOutput.differentials[0]?.likelihoodPct ?? 0,
        }),
      ]
    );

    await dbPool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.doctor_queued', $1, 'system', $2, $3)`,
      [
        "00000000-0000-0000-0000-000000000000",
        consultationId,
        JSON.stringify({ flags, status: engineOutput.cannotAssess ? "cannot_assess" : "queued_for_review" }),
      ]
    );
  } catch (auditErr) {
    logger.error({ auditErr, consultationId }, "clinicalAiEngine: failed to write audit log");
  }

  logger.info(
    { consultationId, flags, cannotAssess: engineOutput.cannotAssess },
    "clinicalAiEngine: complete"
  );
}

// ---------------------------------------------------------------------------
// flagManualTriage — called when all retries are exhausted (F-029, F-030)
// Sets consultation.status = 'ai_failed' so the admin queue can surface it.
// ---------------------------------------------------------------------------
async function flagManualTriage(
  consultationId: string,
  reason: string,
  dbPool: Pool
): Promise<void> {
  // F-030: log at error level with consultationId and error message
  logger.error(
    { consultationId, reason },
    "clinicalAiEngine: all retries exhausted — setting status to ai_failed"
  );

  try {
    // F-029: update consultation.status = 'ai_failed'
    await dbPool.query(
      `UPDATE consultations
       SET status = 'ai_failed',
           priority_flags = array_append(priority_flags, 'ENGINE_FAILED'),
           updated_at = NOW()
       WHERE id = $1`,
      [consultationId]
    );

    await dbPool.query(
      `INSERT INTO audit_log (event_type, actor_id, actor_role, consultation_id, metadata)
       VALUES ('consultation.ai_output_failed', $1, 'system', $2, $3)`,
      [
        "00000000-0000-0000-0000-000000000000",
        consultationId,
        JSON.stringify({ reason }),
      ]
    );
  } catch (err) {
    logger.error({ err, consultationId }, "clinicalAiEngine: failed to write failure audit log");
  }
}
