// PRD-012: PII Anonymisation Layer
//
// Strips personal identifiable information from consultation transcripts before
// any data is sent to an LLM API. Required under Privacy Act APP 8.
//
// PII categories handled:
//   - Medicare numbers (10-digit format, optional space separators)
//   - Phone numbers (AU mobile and landline)
//   - Email addresses
//   - Dates of birth (multiple formats)
//   - Full names (detected via common salutation patterns)
//
// NOTE: Named-entity recognition (NER) for arbitrary names is not performed at
// MVP — only salutation-prefixed names are stripped. This is a known limitation
// documented for Medical Director review.

export interface AnonymisedTranscript {
  text: string;
  replacements: Record<string, string>;
}

// ---------------------------------------------------------------------------
// PII patterns
// ---------------------------------------------------------------------------

const PATTERNS: Array<{ name: string; regex: RegExp; token: string }> = [
  {
    name: "medicare_number",
    // AU Medicare: 10 digits, optionally grouped as NNNN NNNNN N
    regex: /\b\d{4}[ \-]?\d{5}[ \-]?\d\b/g,
    token: "[MEDICARE]",
  },
  {
    name: "phone_number",
    // AU mobile: 04XX XXX XXX; landline: 0N NNNN NNNN; international: +61...
    regex:
      /\b(?:04\d{2}[ \-]?\d{3}[ \-]?\d{3}|0[2-9]\d[ \-]?\d{4}[ \-]?\d{4}|\+61[ \-]?[2-9]\d{3}[ \-]?\d{4})\b/g,
    token: "[PHONE]",
  },
  {
    name: "email",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    token: "[EMAIL]",
  },
  {
    name: "date_of_birth",
    // Matches: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, "born on ...", "DOB:"
    regex:
      /(?:d\.?o\.?b\.?|date of birth|born on)[:\s]+[\d\/\-]+|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/gi,
    token: "[DOB]",
  },
  {
    name: "salutation_name",
    // Strips "Mr/Mrs/Ms/Dr/Prof + Name" patterns
    regex:
      /\b(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    token: "[PATIENT_NAME]",
  },
  {
    name: "medicare_card_expiry",
    // "Medicare expiry MM/YY" or standalone MM/YY after Medicare context
    regex: /\b(?:expiry|expires?)[:\s]+\d{2}[\/\-]\d{2}\b/gi,
    token: "[MEDICARE_EXPIRY]",
  },
];

// ---------------------------------------------------------------------------
// anonymiseText
// Applies all PII patterns to a single string.
// ---------------------------------------------------------------------------
export function anonymiseText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { regex, token } of PATTERNS) {
    result = result.replace(regex, token);
  }
  return result;
}

// ---------------------------------------------------------------------------
// anonymiseTranscript
// Anonymises an array of transcript turns (JSONB from DB).
// Returns anonymised turns as a JSON string suitable for LLM input.
// ---------------------------------------------------------------------------
export interface TranscriptTurn {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms?: number;
  confidence?: number;
}

export function anonymiseTranscript(turns: TranscriptTurn[]): string {
  const anonymised = turns.map((turn) => ({
    speaker: turn.speaker,
    text: anonymiseText(turn.text),
  }));
  return JSON.stringify(anonymised, null, 2);
}

// ---------------------------------------------------------------------------
// isPiiClean
// Verifies that a payload string contains no detectable PII.
// Used in automated tests to assert clean payloads before API calls (PRD F-004).
// ---------------------------------------------------------------------------

const PII_DETECTION_PATTERNS: RegExp[] = [
  /\b\d{4}[ \-]?\d{5}[ \-]?\d\b/,                            // Medicare number
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,   // Email
  /\b(?:04\d{2}[ \-]?\d{3}[ \-]?\d{3}|0[2-9]\d[ \-]?\d{4}[ \-]?\d{4}|\+61[ \-]?[2-9]\d{3}[ \-]?\d{4})\b/, // AU phone
];

export function isPiiClean(payload: string): { clean: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of PII_DETECTION_PATTERNS) {
    if (pattern.test(payload)) {
      violations.push(pattern.source);
    }
  }
  return { clean: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// buildAnonymisedPatientContext
// Produces a safe patient context string for LLM prompts.
// Includes clinical facts but no PII.
// ---------------------------------------------------------------------------
export interface PatientProfile {
  dateOfBirth?: string | null;
  biologicalSex?: string | null;
  isPaediatric?: boolean;
  allergies?: Array<{ name: string; severity: string }>;
  medications?: Array<{ name: string; dose?: string; frequency?: string }>;
  conditions?: Array<{ name: string }>;
}

export function buildAnonymisedPatientContext(patient: PatientProfile): string {
  const lines: string[] = [];

  // Age range from DOB (never the exact DOB)
  if (patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    const today = new Date();
    const ageYears = today.getFullYear() - dob.getFullYear();
    // Round to decade range
    const low = Math.floor(ageYears / 10) * 10;
    lines.push(`Age range: ${low}–${low + 9} years`);
  }

  if (patient.biologicalSex) {
    lines.push(`Biological sex: ${patient.biologicalSex}`);
  }

  if (patient.isPaediatric) {
    lines.push(`Patient type: paediatric`);
  }

  if (patient.allergies && patient.allergies.length > 0) {
    const list = patient.allergies.map((a) => `${a.name} (${a.severity})`).join(", ");
    lines.push(`Known allergies: ${list}`);
  } else {
    lines.push(`Known allergies: none recorded`);
  }

  if (patient.medications && patient.medications.length > 0) {
    const list = patient.medications
      .map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(" "))
      .join("; ");
    lines.push(`Current medications: ${list}`);
  } else {
    lines.push(`Current medications: none recorded`);
  }

  if (patient.conditions && patient.conditions.length > 0) {
    const list = patient.conditions.map((c) => c.name).join(", ");
    lines.push(`Known conditions: ${list}`);
  } else {
    lines.push(`Known conditions: none recorded`);
  }

  return lines.join("\n");
}
