// PRD-008 F-013–F-014: Server-side red flag detection.
// Runs on every transcript delta during a live session.
// Pure function — no DB, no side effects.

export type RedFlagResult =
  | { triggered: false }
  | { triggered: true; phrase: string };

// Each rule is a label + one or more phrase groups that must ALL match
// (AND within a rule, OR across rules).
interface Rule {
  label: string;
  // All groups must match somewhere in the text (order-independent)
  allOf: RegExp[];
}

const RULES: Rule[] = [
  {
    label: "chest pain + breathing difficulty",
    allOf: [
      // Chest pain mention - cardinal feature of ACS/PE/aortic dissection
      /chest pain/i,
      // Dyspnoea/respiratory distress - co-occurrence with chest pain → suspected ACS or pulmonary embolism
      /can'?t breathe|shortness of breath|difficulty breath|trouble breath/i,
    ],
  },
  {
    label: "thunderclap headache",
    // Sudden severe "worst-ever" headache → suspected subarachnoid haemorrhage (SAH)
    allOf: [/thunderclap headache|worst headache of my life|sudden severe headache/i],
  },
  {
    label: "stroke symptoms",
    allOf: [
      // FAST stroke screen positives (facial droop, arm weakness, speech disturbance, sudden confusion) → suspected acute stroke
      /face.{0,20}droop|arm.{0,20}weak|slurred speech|sudden confusion|can'?t speak/i,
    ],
  },
  {
    label: "anaphylaxis",
    // Throat or tongue swelling → suspected anaphylaxis with airway compromise (ASCIA criteria)
    allOf: [/throat.{0,20}swell|tongue.{0,20}swell/i],
  },
  {
    label: "uncontrolled bleeding",
    // Uncontrolled haemorrhage → suspected major bleed requiring emergency haemostasis
    allOf: [/uncontrolled bleeding/i],
  },
  {
    label: "loss of consciousness",
    // Syncope / LOC → suspected cardiac arrhythmia, seizure, or cerebrovascular event requiring urgent assessment
    allOf: [/lost? consciousness|passed? out|fainted|blacked? out/i],
  },
  {
    label: "suicidal ideation",
    allOf: [
      // Active suicidal ideation → mental health emergency requiring immediate escalation per RANZCP guidelines
      /kill myself|end(?:ing)? my life|don'?t want to live|want to die|suicidal/i,
    ],
  },
];

export function detectRedFlag(text: string): RedFlagResult {
  for (const rule of RULES) {
    if (rule.allOf.every((pattern) => pattern.test(text))) {
      return { triggered: true, phrase: rule.label };
    }
  }
  return { triggered: false };
}
