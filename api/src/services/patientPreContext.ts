// PRD-023 F-022/F-023: structured pre-context block for AI sessions.
//
// Returns a minimal anonymised baseline derived from the patient profile so
// the AI assistant can skip identity questions and tailor its opening turn
// to what the patient has on file. PII (name, DOB, Medicare, address, phone)
// is **never** included — only clinically-relevant baseline.
//
// Consumed by:
//   - services/textConsultation.ts (per-call system instruction injection)
//   - services/geminiLive.ts (per-session system prompt prefix)

import { pool } from "../db";

export interface PatientPreContext {
  ageBand: string | null;          // "18-29", "30-44", "45-64", "65+"; never the exact DOB
  sex: string | null;              // already a controlled vocabulary value, no PII
  allergies: string[];             // names only, no severity-detail strings that might contain notes
  allergiesNoneDeclared: boolean;
  medications: string[];           // names only
  medicationsNoneDeclared: boolean;
  conditions: string[];
  conditionsNoneDeclared: boolean;
}

function ageBandFromDob(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ageMs = Date.now() - birth.getTime();
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 18) return "under-18";
  if (years < 30) return "18-29";
  if (years < 45) return "30-44";
  if (years < 65) return "45-64";
  return "65+";
}

interface Row {
  date_of_birth: string | null;
  biological_sex: string | null;
  allergies_none_declared: boolean;
  medications_none_declared: boolean;
  conditions_none_declared: boolean;
  allergies: { name: string }[] | null;
  medications: { name: string }[] | null;
  conditions: { name: string }[] | null;
}

export async function getPatientPreContext(
  consultationId: string
): Promise<PatientPreContext | null> {
  const { rows } = await pool.query<Row>(
    `SELECT
       to_char(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
       p.biological_sex,
       p.allergies_none_declared,
       p.medications_none_declared,
       p.conditions_none_declared,
       (SELECT json_agg(json_build_object('name', a.name))
          FROM patient_allergies a    WHERE a.patient_id   = p.id) AS allergies,
       (SELECT json_agg(json_build_object('name', m.name))
          FROM patient_medications m  WHERE m.patient_id   = p.id) AS medications,
       (SELECT json_agg(json_build_object('name', con.name))
          FROM patient_conditions con WHERE con.patient_id = p.id) AS conditions
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     WHERE c.id = $1`,
    [consultationId]
  );
  const row = rows[0];
  if (!row) return null;

  return {
    ageBand: ageBandFromDob(row.date_of_birth),
    sex: row.biological_sex,
    allergies: (row.allergies ?? []).map((a) => a.name),
    allergiesNoneDeclared: row.allergies_none_declared,
    medications: (row.medications ?? []).map((m) => m.name),
    medicationsNoneDeclared: row.medications_none_declared,
    conditions: (row.conditions ?? []).map((c) => c.name),
    conditionsNoneDeclared: row.conditions_none_declared,
  };
}

// Renders the pre-context as a compact system-prompt prefix. Returns the
// empty string when there is genuinely nothing to say so we don't pollute
// the prompt for brand-new accounts.
export function renderPreContextPrompt(ctx: PatientPreContext | null): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.ageBand) lines.push(`Age band: ${ctx.ageBand}`);
  if (ctx.sex) lines.push(`Biological sex: ${ctx.sex}`);

  function summarise(label: string, items: string[], noneDeclared: boolean): string | null {
    if (items.length > 0) return `${label}: ${items.join(", ")}`;
    if (noneDeclared) return `${label}: none reported`;
    return null;
  }
  const a = summarise("Known allergies", ctx.allergies, ctx.allergiesNoneDeclared);
  const m = summarise("Current medications", ctx.medications, ctx.medicationsNoneDeclared);
  const c = summarise("Known conditions", ctx.conditions, ctx.conditionsNoneDeclared);
  if (a) lines.push(a);
  if (m) lines.push(m);
  if (c) lines.push(c);

  if (lines.length === 0) return "";
  return [
    "PATIENT BASELINE (already on file — do not re-ask these unless clarifying):",
    ...lines.map((l) => `- ${l}`),
  ].join("\n");
}
