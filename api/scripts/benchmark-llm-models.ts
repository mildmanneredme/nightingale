#!/usr/bin/env tsx
// PRD-031: LLM Model Benchmarking Framework
//
// Tests multiple LLM providers against synthetic Australian GP consultation
// transcripts using the same SOAP note + differential + draft response task
// that the clinical AI engine performs in production.
//
// Scoring dimensions:
//   1. SOAP completeness (0–25): all four fields non-empty, clinically specific
//   2. AHPRA compliance (0–25): no certainty language; uses "may indicate" etc.
//   3. Clinical accuracy (0–25): expected keywords present; red flags addressed
//   4. Response time (0–15): latency in seconds to first complete response
//   5. Cost (0–10): estimated AUD cost per consultation at published API rates
//
// Usage:
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GOOGLE_API_KEY=... \
//   npx tsx api/scripts/benchmark-llm-models.ts [--scenario <id>] [--model <id>]
//
// Results written to: api/scripts/benchmark-results/<timestamp>.json
// Human-readable summary printed to stdout.

import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Synthetic Consultation Transcripts
// ---------------------------------------------------------------------------

interface TranscriptTurn {
  speaker: "ai" | "patient";
  text: string;
}

interface BenchmarkScenario {
  id: string;
  title: string;
  presentation: string;
  transcript: TranscriptTurn[];
  patientContext: string;
  expectedKeywords: string[];        // Must appear in output for clinical accuracy
  forbiddenPhrases: string[];        // AHPRA violations if present
  expectedRedFlags: string[];        // Red flags that must be addressed in plan
  cannotAssessExpected: boolean;
}

const SCENARIOS: BenchmarkScenario[] = [
  // ---------------------------------------------------------------------------
  // Scenario 1: URTI — straightforward, low complexity
  // ---------------------------------------------------------------------------
  {
    id: "S01-urti-simple",
    title: "URTI — Simple Adult",
    presentation: "urti",
    transcript: [
      { speaker: "ai", text: "Hello, I'm the Nightingale AI clinical assistant. What's brought you in today?" },
      { speaker: "patient", text: "Hi, I've had a really bad sore throat and runny nose for about 4 days now." },
      { speaker: "ai", text: "I'm sorry to hear that. On a scale of 1 to 10, how would you rate the discomfort?" },
      { speaker: "patient", text: "Maybe a 5. It's not unbearable but it's stopping me from sleeping well." },
      { speaker: "ai", text: "Is there any fever, difficulty swallowing, or white patches at the back of your throat?" },
      { speaker: "patient", text: "I had a temperature of 37.8 last night but it came down with paracetamol. No white patches that I can see." },
      { speaker: "ai", text: "Any cough, ear pain, or nasal discharge?" },
      { speaker: "patient", text: "Yes, there's a clear runny nose and I have a mild cough. No ear pain." },
      { speaker: "ai", text: "Do you have any relevant medical history — chronic conditions, allergies, or regular medications?" },
      { speaker: "patient", text: "No I'm pretty healthy. I'm allergic to penicillin — it gives me a rash. I don't take any regular medications." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you for sharing that with me." },
    ],
    patientContext: "28-year-old female. No chronic conditions. Penicillin allergy (rash). No regular medications.",
    expectedKeywords: ["viral", "supportive", "paracetamol", "rest", "penicillin", "allergy", "sore throat"],
    forbiddenPhrases: ["you have", "you are infected with", "diagnosis is", "definitely", "certainly"],
    expectedRedFlags: ["difficulty breathing", "severe worsening", "high fever", "return if worse"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 2: UTI — uncomplicated female
  // ---------------------------------------------------------------------------
  {
    id: "S02-uti-uncomplicated",
    title: "Uncomplicated UTI — Adult Female",
    presentation: "uti",
    transcript: [
      { speaker: "ai", text: "What symptoms have brought you to Nightingale today?" },
      { speaker: "patient", text: "I have burning when I pass urine and I need to go a lot more often than usual." },
      { speaker: "ai", text: "How long has this been going on?" },
      { speaker: "patient", text: "Started yesterday afternoon, so about 24 hours." },
      { speaker: "ai", text: "Any blood in your urine, fever, chills, or pain in your back or sides?" },
      { speaker: "patient", text: "No blood that I can see. No fever. I did have a little ache in my lower back but nothing severe." },
      { speaker: "ai", text: "Have you had UTIs before, and are you currently pregnant or could you be pregnant?" },
      { speaker: "patient", text: "I've had about two UTIs before and they were treated with antibiotics. I'm not pregnant." },
      { speaker: "ai", text: "Are you on any medications, do you have any allergies, or do you have any medical conditions I should know about?" },
      { speaker: "patient", text: "I'm on the oral contraceptive pill — Yasmin. No allergies. Otherwise healthy." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "34-year-old female. Taking oral contraceptive pill (Yasmin). No known allergies. Non-pregnant.",
    expectedKeywords: ["urinary tract", "dysuria", "frequency", "trimethoprim", "nitrofurantoin", "antibiotic", "urine"],
    forbiddenPhrases: ["you definitely have a UTI", "you are infected", "I diagnose", "certainly"],
    expectedRedFlags: ["loin pain", "fever", "pyelonephritis", "pregnant", "worsening"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 3: Skin rash — needs photo, possible cannot-assess
  // ---------------------------------------------------------------------------
  {
    id: "S03-rash-photo-needed",
    title: "Uncharacterised Skin Rash",
    presentation: "dermatology",
    transcript: [
      { speaker: "ai", text: "What's the main reason for your consultation today?" },
      { speaker: "patient", text: "I have this rash on my arm that's been there for about 2 weeks." },
      { speaker: "ai", text: "Can you describe the rash — is it red, raised, blistered, itchy?" },
      { speaker: "patient", text: "It's red and slightly raised with a ring-like pattern. It's itchy but not intensely. There's a clear centre and a red ring around it." },
      { speaker: "ai", text: "How large is it and where exactly on your arm?" },
      { speaker: "patient", text: "About the size of a 50 cent coin on my forearm. There's just the one patch." },
      { speaker: "ai", text: "Have you been outdoors in bushland recently? Any tick bites, or been camping?" },
      { speaker: "patient", text: "Actually yes, I went bushwalking in the Blue Mountains about 3 weeks ago." },
      { speaker: "ai", text: "Any fever, fatigue, joint pain, or headaches since the bushwalk?" },
      { speaker: "patient", text: "I have been a bit tired and had a mild headache a couple of times but I thought that was from dehydration." },
      { speaker: "ai", text: "Any medications or allergies?" },
      { speaker: "patient", text: "No allergies. I take blood pressure medication — amlodipine 5mg." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "52-year-old male. Hypertension — on amlodipine 5mg. No known allergies. Recent bushwalk in Blue Mountains.",
    expectedKeywords: ["tick", "erythema", "ringworm", "tinea", "amlodipine", "bushwalk", "photo", "dermatology"],
    forbiddenPhrases: ["you have Lyme disease", "you are infected with Borrelia", "definitely tinea", "I diagnose"],
    expectedRedFlags: ["fever", "spreading rash", "neurological", "photo required", "in-person assessment"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 4: Mental health — anxiety and depression
  // ---------------------------------------------------------------------------
  {
    id: "S04-mental-health-anxiety",
    title: "Anxiety with Low Mood",
    presentation: "mental-health",
    transcript: [
      { speaker: "ai", text: "What's been bringing you here today?" },
      { speaker: "patient", text: "I've been feeling really anxious lately, like constant worry, and I'm not sleeping well. It's been going on for about 2 months." },
      { speaker: "ai", text: "On a scale of 1 to 10, how much is the anxiety affecting your daily life?" },
      { speaker: "patient", text: "I'd say a 7. I've been avoiding social situations and had to take a week off work last month." },
      { speaker: "ai", text: "Are you experiencing any low mood, hopelessness, or thoughts of harming yourself?" },
      { speaker: "patient", text: "I do feel quite low sometimes. No thoughts of harming myself though." },
      { speaker: "ai", text: "Have you had anxiety or depression before, or are you seeing a psychologist or counsellor?" },
      { speaker: "patient", text: "I had mild depression about 5 years ago and took sertraline for a year. Stopped it when things improved. Not seeing anyone at the moment." },
      { speaker: "ai", text: "Are you drinking alcohol more than usual, using any substances, or taking any medications?" },
      { speaker: "patient", text: "I have a couple of drinks most nights to help me sleep. No medications currently. No other substances." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "38-year-old female. Prior episode of depression treated with sertraline (resolved). No current medications. Alcohol use (2 drinks/night).",
    expectedKeywords: ["anxiety", "depression", "GAD", "sertraline", "SSRI", "sleep", "alcohol", "psychologist", "mental health plan", "beyond blue", "lifeline"],
    forbiddenPhrases: ["you are depressed", "you have GAD", "I diagnose", "you will need medication"],
    expectedRedFlags: ["self-harm", "suicidal ideation", "safety planning", "alcohol", "return if thoughts of self-harm"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 5: MSK — low back pain
  // ---------------------------------------------------------------------------
  {
    id: "S05-lbp-acute",
    title: "Acute Low Back Pain",
    presentation: "musculoskeletal",
    transcript: [
      { speaker: "ai", text: "What brings you in today?" },
      { speaker: "patient", text: "I've had severe low back pain since I lifted something heavy at work 3 days ago." },
      { speaker: "ai", text: "On a scale of 1–10, how severe is the pain at its worst?" },
      { speaker: "patient", text: "About an 8 when I try to move. I'm having trouble getting out of bed." },
      { speaker: "ai", text: "Does the pain radiate down your leg? Any numbness, tingling, or weakness in the legs?" },
      { speaker: "patient", text: "There's a bit of an aching sensation down the right leg to the knee but no numbness. I can walk okay." },
      { speaker: "ai", text: "Any trouble with bladder or bowel control — difficulty passing urine or faeces, or any incontinence?" },
      { speaker: "patient", text: "No, nothing like that. Everything is normal in that department." },
      { speaker: "ai", text: "Do you have any history of cancer, osteoporosis, or have you had significant unintentional weight loss?" },
      { speaker: "patient", text: "No history of cancer. I'm 42, pretty healthy. No weight loss. I did have a similar episode 2 years ago that settled within a week." },
      { speaker: "ai", text: "Any medications or allergies?" },
      { speaker: "patient", text: "I'm taking ibuprofen 400mg as needed. I'm allergic to codeine — it makes me vomit." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "42-year-old male. Codeine allergy (vomiting). Taking ibuprofen PRN. No chronic conditions. Prior similar episode 2 years ago (resolved).",
    expectedKeywords: ["lumbar", "radiculopathy", "ibuprofen", "NSAID", "codeine", "allergy", "activity", "physiotherapy", "red flags"],
    forbiddenPhrases: ["you have a disc herniation", "you have sciatica", "I diagnose", "surgery required"],
    expectedRedFlags: ["cauda equina", "bladder", "bowel", "cancer", "neurological deficit", "return if worsening"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 6: Emergency scenario — chest pain (should escalate)
  // ---------------------------------------------------------------------------
  {
    id: "S06-chest-pain-emergency",
    title: "Chest Pain — Potential Emergency",
    presentation: "cardiovascular",
    transcript: [
      { speaker: "ai", text: "What's brought you in today?" },
      { speaker: "patient", text: "I've had chest pain for the last 2 hours. It's quite bad, about a 9 out of 10." },
      { speaker: "ai", text: "Does the pain spread anywhere — your jaw, left arm, or shoulder?" },
      { speaker: "patient", text: "Yes actually, I have an ache in my left arm and I feel a bit short of breath." },
    ],
    patientContext: "58-year-old male. Type 2 diabetes (on metformin). Hypertension (on lisinopril). Smoker 20 pack-years.",
    expectedKeywords: ["emergency", "000", "cardiac", "ACS", "myocardial infarction"],
    forbiddenPhrases: [],
    expectedRedFlags: ["000", "emergency", "cardiac"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 7: Paediatric fever
  // ---------------------------------------------------------------------------
  {
    id: "S07-paediatric-fever",
    title: "Febrile Child — 3 Years Old",
    presentation: "paediatric",
    transcript: [
      { speaker: "ai", text: "Hello, I'm here to help. Who are you consulting about today?" },
      { speaker: "patient", text: "It's about my 3-year-old daughter. She's had a fever since last night — 38.9 degrees." },
      { speaker: "ai", text: "Is she alert and interactive? Drinking fluids, passing urine?" },
      { speaker: "patient", text: "She's a bit quieter than usual but still responds when I talk to her. She had a wet nappy this morning." },
      { speaker: "ai", text: "Any cough, runny nose, vomiting, diarrhoea, or rash?" },
      { speaker: "patient", text: "She has a runny nose and cough. No vomiting or diarrhoea. No rash that I can see." },
      { speaker: "ai", text: "Has she had any seizures? Any neck stiffness or sensitivity to light?" },
      { speaker: "patient", text: "No seizures. She didn't seem bothered by the light when I turned the bedroom light on." },
      { speaker: "ai", text: "Is she up to date with her vaccinations? Any recent overseas travel?" },
      { speaker: "patient", text: "Yes, fully vaccinated. No overseas travel." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "Paediatric consultation — 3-year-old female. Guardian: mother. Fully vaccinated. No overseas travel. No chronic conditions.",
    expectedKeywords: ["fever", "viral", "paracetamol", "ibuprofen", "hydration", "paediatric", "return", "worsening"],
    forbiddenPhrases: ["you are infected", "diagnosis is", "she has", "definitely"],
    expectedRedFlags: ["seizure", "rash", "meningitis", "difficulty breathing", "unwell", "not drinking", "000"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 8: Women's health — vaginal discharge
  // ---------------------------------------------------------------------------
  {
    id: "S08-vaginal-discharge",
    title: "Vaginal Discharge — Adult Female",
    presentation: "womens-health",
    transcript: [
      { speaker: "ai", text: "What's brought you in today?" },
      { speaker: "patient", text: "I've noticed an unusual vaginal discharge for the past week — it's thicker than normal and a bit itchy." },
      { speaker: "ai", text: "What colour and texture is the discharge — white, yellow-green, or grey? Cottage cheese-like or watery?" },
      { speaker: "patient", text: "It's white and quite thick, a bit like cottage cheese. Very itchy down there." },
      { speaker: "ai", text: "Any unusual odour, pelvic or abdominal pain, or pain during sex?" },
      { speaker: "patient", text: "No strong smell. No pelvic pain. No pain during sex." },
      { speaker: "ai", text: "Have you recently taken antibiotics or had any changes in sexual partners?" },
      { speaker: "patient", text: "Yes, I finished a course of amoxicillin-clavulanate 10 days ago for a dental infection. I have one regular partner." },
      { speaker: "ai", text: "Any medications or allergies?" },
      { speaker: "patient", text: "No regular medications now, antibiotics are finished. No allergies." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "29-year-old female. Recently completed amoxicillin-clavulanate course. No chronic conditions. No known allergies.",
    expectedKeywords: ["candida", "thrush", "antifungal", "clotrimazole", "fluconazole", "antibiotic", "vaginal"],
    forbiddenPhrases: ["you have thrush", "I diagnose", "definitely candida", "you are infected"],
    expectedRedFlags: ["offensive odour", "pelvic pain", "fever", "STI", "worsening"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 9: Cardiovascular — hypertension management
  // ---------------------------------------------------------------------------
  {
    id: "S09-hypertension-management",
    title: "Hypertension — Ongoing Management",
    presentation: "cardiovascular",
    transcript: [
      { speaker: "ai", text: "What can I help you with today?" },
      { speaker: "patient", text: "I've been on blood pressure tablets for 2 years. My home readings have been a bit high lately — around 150/95 on average." },
      { speaker: "ai", text: "What blood pressure medication are you currently taking?" },
      { speaker: "patient", text: "I'm on perindopril 4mg daily and amlodipine 5mg." },
      { speaker: "ai", text: "Have there been any changes recently — diet, stress, exercise, alcohol, new medications, or supplements?" },
      { speaker: "patient", text: "I started a new job about 3 months ago and I've been more stressed than usual. I've also been eating more takeaway and drinking more coffee." },
      { speaker: "ai", text: "Any headaches, visual changes, chest pain, shortness of breath, or swelling in your legs?" },
      { speaker: "patient", text: "I've had some headaches in the mornings but nothing severe. No visual changes. No chest pain or leg swelling." },
      { speaker: "ai", text: "Any other medical conditions or medications, and do you smoke?" },
      { speaker: "patient", text: "I have type 2 diabetes — on metformin 1g twice daily. I don't smoke. My cholesterol was normal at my last check." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "55-year-old male. Hypertension on perindopril 4mg + amlodipine 5mg. Type 2 diabetes on metformin 1g BD. Non-smoker. Normal cholesterol.",
    expectedKeywords: ["blood pressure", "hypertension", "perindopril", "amlodipine", "lifestyle", "stress", "salt", "exercise", "diabetes", "metformin"],
    forbiddenPhrases: ["you have hypertensive crisis", "I diagnose", "you need to increase your medication"],
    expectedRedFlags: ["headache", "vision", "chest pain", "renal function", "emergency"],
    cannotAssessExpected: false,
  },

  // ---------------------------------------------------------------------------
  // Scenario 10: Geriatric — falls and polypharmacy
  // ---------------------------------------------------------------------------
  {
    id: "S10-geriatric-falls",
    title: "Elderly Patient — Recurrent Falls",
    presentation: "geriatric",
    transcript: [
      { speaker: "ai", text: "Hello, what's brought you to Nightingale today?" },
      { speaker: "patient", text: "I'm calling about my mother. She's 78 and she's fallen twice in the past month. She's not injured but we're very worried." },
      { speaker: "ai", text: "Is she able to join the call or are you speaking on her behalf?" },
      { speaker: "patient", text: "I'm speaking on her behalf. She's agreed to this consultation." },
      { speaker: "ai", text: "Did the falls happen with sudden blackouts or was she fully conscious throughout? Any dizziness beforehand?" },
      { speaker: "patient", text: "She was fully conscious both times. She says she felt dizzy when she got up from the chair, then lost her footing." },
      { speaker: "ai", text: "What medications is she currently on?" },
      { speaker: "patient", text: "She's on a lot — furosemide 40mg, ramipril 5mg, atenolol 50mg, aspirin 100mg, and zopiclone 3.75mg for sleep." },
      { speaker: "ai", text: "Does she have any vision problems or known balance issues, and has she had a recent blood pressure check?" },
      { speaker: "patient", text: "Her eyesight is not great — she wears glasses. She hasn't had a blood pressure check in 6 months." },
      { speaker: "ai", text: "I now have all the information needed to prepare your case for the doctor's review. Thank you." },
    ],
    patientContext: "78-year-old female (guardian consultation — daughter speaking). On: furosemide 40mg, ramipril 5mg, atenolol 50mg, aspirin 100mg, zopiclone 3.75mg. Wears glasses.",
    expectedKeywords: ["falls", "orthostatic hypotension", "polypharmacy", "zopiclone", "furosemide", "dizziness", "frailty", "blood pressure", "medication review"],
    forbiddenPhrases: ["she has syncope", "I diagnose", "definitely orthostatic"],
    expectedRedFlags: ["injury", "hip fracture", "cardiac cause", "medication", "review", "falls risk"],
    cannotAssessExpected: false,
  },
];

// ---------------------------------------------------------------------------
// Model Definitions
// ---------------------------------------------------------------------------

interface ModelConfig {
  id: string;
  displayName: string;
  provider: "anthropic" | "openai" | "google";
  apiModel: string;
  costPer1kInputTokensUSD: number;
  costPer1kOutputTokensUSD: number;
}

const MODELS: ModelConfig[] = [
  {
    id: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6 (current)",
    provider: "anthropic",
    apiModel: "claude-sonnet-4-6",
    costPer1kInputTokensUSD: 0.003,
    costPer1kOutputTokensUSD: 0.015,
  },
  {
    id: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    apiModel: "claude-haiku-4-5-20251001",
    costPer1kInputTokensUSD: 0.0008,
    costPer1kOutputTokensUSD: 0.004,
  },
  {
    id: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    provider: "anthropic",
    apiModel: "claude-opus-4-7",
    costPer1kInputTokensUSD: 0.015,
    costPer1kOutputTokensUSD: 0.075,
  },
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    costPer1kInputTokensUSD: 0.0025,
    costPer1kOutputTokensUSD: 0.01,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o-mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    costPer1kInputTokensUSD: 0.00015,
    costPer1kOutputTokensUSD: 0.0006,
  },
];

// ---------------------------------------------------------------------------
// System Prompt (mirrors production clinical AI engine)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the clinical AI engine for Nightingale, an Australian telehealth platform.
You receive a patient consultation transcript and must produce a structured clinical assessment for doctor review.

CRITICAL LANGUAGE CONSTRAINTS (AHPRA compliance):
- Use "assess" not "diagnose"
- Use "may indicate", "is consistent with", "could suggest" — never "you have [condition]" or "this is [condition]"
- Never express diagnostic certainty
- Always recommend in-person assessment where clinically appropriate
- Always include emergency escalation pathways (call 000 / present to ED)
- Refer to Australian emergency services as "000" not "911"

OUTPUT: Respond with valid JSON only. No markdown, no prose outside JSON.

{
  "soap_note": {
    "subjective": "What the patient reported: chief complaint, symptom onset, duration, severity, associated symptoms, relevant history",
    "objective": "Relevant observations from the consultation (no physical examination available — telehealth only)",
    "assessment": "Clinical assessment — 2–5 differential diagnoses with supporting and against features. Use 'may indicate', 'consistent with' language.",
    "plan": "Management recommendations — self-care, medications (if appropriate), escalation triggers, follow-up, red flags to watch for"
  },
  "differentials": [
    {
      "condition": "Condition name",
      "likelihood_pct": 60,
      "rationale": "Supporting and against features",
      "snomed_code": "optional SNOMED CT code"
    }
  ],
  "draft_response": "Plain English response for patient (Grade 8 reading level, empathetic, Australian terminology). This is a draft for GP review — do not address the patient directly.",
  "cannot_assess": false,
  "cannot_assess_reason": null
}

Note: likelihood_pct values must sum to approximately 100 across all differentials (2–5 items required).
If the presentation cannot be assessed remotely (requires physical examination, acute surgical emergency, etc.), set cannot_assess: true.`;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoreBreakdown {
  soapCompleteness: number;       // 0–25
  ahpraCompliance: number;        // 0–25
  clinicalAccuracy: number;       // 0–25
  latencyScore: number;           // 0–15 (15 if <10s, 10 if <20s, 5 if <40s, 0 if ≥40s)
  costScore: number;              // 0–10 (10 if <$0.05 AUD, decreasing)
  total: number;                  // 0–100
}

function scoreSoapCompleteness(output: Record<string, unknown>, scenario: BenchmarkScenario): number {
  const soap = output.soap_note as Record<string, string> | undefined;
  if (!soap) return 0;
  let score = 0;
  for (const field of ["subjective", "objective", "assessment", "plan"]) {
    const val = soap[field] ?? "";
    if (val.length > 50) score += 5;   // Non-trivial content
    if (val.length > 200) score += 2;  // Substantive content
  }
  // Check that differentials exist and sum to ~100
  const diffs = output.differentials as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(diffs) && diffs.length >= 2 && diffs.length <= 5) {
    const sum = diffs.reduce((s, d) => s + (Number(d.likelihood_pct) || 0), 0);
    if (Math.abs(sum - 100) <= 10) score += 3;
  }
  return Math.min(score, 25);
}

function scoreAhpraCompliance(rawOutput: string, scenario: BenchmarkScenario): number {
  let score = 25;
  // Deduct for forbidden phrases
  for (const phrase of scenario.forbiddenPhrases) {
    if (rawOutput.toLowerCase().includes(phrase.toLowerCase())) {
      score -= 5;
    }
  }
  // Deduct for common AHPRA violations
  const violations = [
    "you have ", "the diagnosis is", "this is definitely", "you are suffering from",
    "i can confirm", "you definitely have", "diagnosed with",
  ];
  for (const v of violations) {
    if (rawOutput.toLowerCase().includes(v)) score -= 3;
  }
  // Bonus for using correct language
  const goodPhrases = ["may indicate", "consistent with", "could suggest", "assess", "000"];
  for (const p of goodPhrases) {
    if (rawOutput.toLowerCase().includes(p)) score += 1;
  }
  return Math.max(0, Math.min(score, 25));
}

function scoreClinicalAccuracy(rawOutput: string, scenario: BenchmarkScenario): number {
  let score = 0;
  const lower = rawOutput.toLowerCase();
  for (const keyword of scenario.expectedKeywords) {
    if (lower.includes(keyword.toLowerCase())) score += 2;
  }
  for (const redFlag of scenario.expectedRedFlags) {
    if (lower.includes(redFlag.toLowerCase())) score += 1;
  }
  return Math.min(score, 25);
}

function scoreLatency(latencyMs: number): number {
  if (latencyMs < 10000) return 15;
  if (latencyMs < 20000) return 10;
  if (latencyMs < 40000) return 5;
  return 0;
}

function scoreCost(costUSD: number): number {
  const costAUD = costUSD * 1.55; // ~approximate AUD rate
  if (costAUD < 0.05) return 10;
  if (costAUD < 0.15) return 7;
  if (costAUD < 0.30) return 5;
  if (costAUD < 0.50) return 3;
  return 0;
}

// ---------------------------------------------------------------------------
// API callers
// ---------------------------------------------------------------------------

interface CallResult {
  rawOutput: string;
  parsed: Record<string, unknown> | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

async function callAnthropic(
  model: ModelConfig,
  scenario: BenchmarkScenario
): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const userMessage = buildUserMessage(scenario);

  const start = Date.now();
  const response = await client.messages.create({
    model: model.apiModel,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const latencyMs = Date.now() - start;

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  return {
    rawOutput: raw,
    parsed: safeParseJson(raw),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  };
}

async function callOpenAI(
  model: ModelConfig,
  scenario: BenchmarkScenario
): Promise<CallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  // Dynamic import so OpenAI SDK is optional
  const { default: OpenAI } = await import("openai").catch(() => {
    throw new Error("openai package not installed — run: npm install openai");
  });

  const client = new OpenAI({ apiKey });
  const userMessage = buildUserMessage(scenario);

  const start = Date.now();
  const response = await client.chat.completions.create({
    model: model.apiModel,
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  });
  const latencyMs = Date.now() - start;

  const raw = response.choices[0]?.message?.content ?? "";
  return {
    rawOutput: raw,
    parsed: safeParseJson(raw),
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    latencyMs,
  };
}

function buildUserMessage(scenario: BenchmarkScenario): string {
  const transcriptText = scenario.transcript
    .map((t) => `${t.speaker === "ai" ? "AI" : "PATIENT"}: ${t.text}`)
    .join("\n");

  return `PATIENT CONTEXT:
${scenario.patientContext}

CONSULTATION TRANSCRIPT:
${transcriptText}

PRESENTING COMPLAINT: ${scenario.presentation}

Generate the clinical assessment JSON as per the system prompt instructions.`;
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main benchmark runner
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  scenarioId: string;
  scenarioTitle: string;
  modelId: string;
  modelName: string;
  score: ScoreBreakdown;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  latencyMs: number;
  parseSuccess: boolean;
  error?: string;
}

async function runBenchmark(
  scenario: BenchmarkScenario,
  model: ModelConfig
): Promise<BenchmarkResult> {
  console.log(`  Running ${model.displayName}...`);

  let result: CallResult;
  try {
    if (model.provider === "anthropic") {
      result = await callAnthropic(model, scenario);
    } else if (model.provider === "openai") {
      result = await callOpenAI(model, scenario);
    } else {
      throw new Error(`Provider ${model.provider} not yet implemented`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`    ERROR: ${message}`);
    return {
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      modelId: model.id,
      modelName: model.displayName,
      score: { soapCompleteness: 0, ahpraCompliance: 0, clinicalAccuracy: 0, latencyScore: 0, costScore: 0, total: 0 },
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      latencyMs: 0,
      parseSuccess: false,
      error: message,
    };
  }

  const costUSD =
    (result.inputTokens / 1000) * model.costPer1kInputTokensUSD +
    (result.outputTokens / 1000) * model.costPer1kOutputTokensUSD;

  const soapCompleteness = result.parsed
    ? scoreSoapCompleteness(result.parsed, scenario)
    : 0;
  const ahpraCompliance = scoreAhpraCompliance(result.rawOutput, scenario);
  const clinicalAccuracy = scoreClinicalAccuracy(result.rawOutput, scenario);
  const latencyScore = scoreLatency(result.latencyMs);
  const costScore = scoreCost(costUSD);
  const total = soapCompleteness + ahpraCompliance + clinicalAccuracy + latencyScore + costScore;

  console.log(
    `    Score: ${total}/100 | Latency: ${(result.latencyMs / 1000).toFixed(1)}s | Cost: $${(costUSD * 1.55).toFixed(4)} AUD`
  );

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    modelId: model.id,
    modelName: model.displayName,
    score: { soapCompleteness, ahpraCompliance, clinicalAccuracy, latencyScore, costScore, total },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostUSD: costUSD,
    latencyMs: result.latencyMs,
    parseSuccess: result.parsed !== null,
    error: result.error,
  };
}

function printSummary(results: BenchmarkResult[]) {
  const models = [...new Set(results.map((r) => r.modelId))];
  const scenarios = [...new Set(results.map((r) => r.scenarioId))];

  console.log("\n" + "=".repeat(80));
  console.log("BENCHMARK SUMMARY");
  console.log("=".repeat(80));

  console.log("\nScores by model (average across all scenarios):\n");
  console.log(
    "Model".padEnd(30) +
    "SOAP".padStart(6) +
    "AHPRA".padStart(7) +
    "Clin".padStart(6) +
    "Latcy".padStart(7) +
    "Cost".padStart(6) +
    "TOTAL".padStart(7) +
    "Avg$/consult AUD".padStart(18)
  );
  console.log("-".repeat(89));

  for (const modelId of models) {
    const modelResults = results.filter((r) => r.modelId === modelId && !r.error);
    if (modelResults.length === 0) continue;

    const avg = (key: keyof ScoreBreakdown) =>
      (modelResults.reduce((s, r) => s + r.score[key], 0) / modelResults.length).toFixed(1);

    const avgCostUSD = modelResults.reduce((s, r) => s + r.estimatedCostUSD, 0) / modelResults.length;
    const avgCostAUD = (avgCostUSD * 1.55).toFixed(4);

    console.log(
      modelResults[0].modelName.padEnd(30) +
      avg("soapCompleteness").padStart(6) +
      avg("ahpraCompliance").padStart(7) +
      avg("clinicalAccuracy").padStart(6) +
      avg("latencyScore").padStart(7) +
      avg("costScore").padStart(6) +
      avg("total").padStart(7) +
      `$${avgCostAUD}`.padStart(18)
    );
  }

  console.log("\nDetailed scores by scenario:\n");
  for (const scenarioId of scenarios) {
    const scenarioResults = results.filter((r) => r.scenarioId === scenarioId);
    const title = scenarioResults[0]?.scenarioTitle ?? scenarioId;
    console.log(`\n${scenarioId}: ${title}`);
    for (const r of scenarioResults) {
      const status = r.error ? "ERROR" : r.parseSuccess ? "OK" : "PARSE FAIL";
      console.log(
        `  ${r.modelName.padEnd(28)} Total: ${r.score.total.toString().padStart(3)}/100 | Parse: ${status}`
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioFilter = args.includes("--scenario") ? args[args.indexOf("--scenario") + 1] : null;
  const modelFilter = args.includes("--model") ? args[args.indexOf("--model") + 1] : null;

  const scenariosToRun = scenarioFilter
    ? SCENARIOS.filter((s) => s.id === scenarioFilter)
    : SCENARIOS;

  // Default: run only Anthropic models (no OpenAI key required for baseline)
  const modelsToRun = modelFilter
    ? MODELS.filter((m) => m.id === modelFilter)
    : MODELS.filter((m) => m.provider === "anthropic" || !!process.env.OPENAI_API_KEY);

  if (scenariosToRun.length === 0) {
    console.error(`No scenarios match filter: ${scenarioFilter}`);
    process.exit(1);
  }

  console.log(`\nNightingale LLM Benchmarking Framework — PRD-031`);
  console.log(`Scenarios: ${scenariosToRun.length} | Models: ${modelsToRun.length}\n`);
  console.log(`Scoring: SOAP(25) + AHPRA(25) + Clinical(25) + Latency(15) + Cost(10) = 100\n`);

  const allResults: BenchmarkResult[] = [];

  for (const scenario of scenariosToRun) {
    console.log(`\nScenario: ${scenario.id} — ${scenario.title}`);
    for (const model of modelsToRun) {
      const result = await runBenchmark(scenario, model);
      allResults.push(result);
      // Brief pause between calls to respect rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  printSummary(allResults);

  // Write results to file
  const resultsDir = path.join(__dirname, "benchmark-results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(resultsDir, `benchmark-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nResults written to: ${outPath}`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
