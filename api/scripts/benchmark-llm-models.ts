#!/usr/bin/env tsx
// PRD-031: LLM Model Benchmarking Framework
//
// Tests flagship models from Anthropic, OpenAI, and Google against synthetic
// Australian GP consultation transcripts using the exact production task format.
//
// Configured models (as of 2026-04-28):
//   - Claude Sonnet 4.6    (Anthropic — current production model)
//   - Claude Opus 4.7      (Anthropic — most capable)
//   - GPT-5.5              (OpenAI — current flagship, released 2026-04-23)
//   - Gemini 3.1 Pro       (Google — current flagship, released 2026-02-19)
//
// API keys are read from api/.env (same file as the main server).
// Add OPENAI_API_KEY= to api/.env before running.
//
// Usage:
//   npx tsx api/scripts/benchmark-llm-models.ts
//   npx tsx api/scripts/benchmark-llm-models.ts --scenario S04-mental-health-anxiety
//   npx tsx api/scripts/benchmark-llm-models.ts --model claude-sonnet-4-6
//
// Results: api/scripts/benchmark-results/<timestamp>.json + stdout summary

import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Load api/.env into process.env (avoids requiring a separate dotenv install)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnv();

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
  expectedKeywords: string[];
  forbiddenPhrases: string[];
  expectedRedFlags: string[];
}

const SCENARIOS: BenchmarkScenario[] = [
  {
    id: "S01-urti-simple",
    title: "URTI — Simple Adult",
    presentation: "urti",
    transcript: [
      { speaker: "ai", text: "Hello, I'm the Nightingale AI clinical assistant. What's brought you in today?" },
      { speaker: "patient", text: "Hi, I've had a really bad sore throat and runny nose for about 4 days now." },
      { speaker: "ai", text: "On a scale of 1 to 10, how would you rate the discomfort?" },
      { speaker: "patient", text: "Maybe a 5. It's stopping me from sleeping well." },
      { speaker: "ai", text: "Any fever, difficulty swallowing, or white patches at the back of your throat?" },
      { speaker: "patient", text: "I had a temperature of 37.8 last night. No white patches that I can see." },
      { speaker: "ai", text: "Any cough or ear pain?" },
      { speaker: "patient", text: "Yes, there's a clear runny nose and a mild cough. No ear pain." },
      { speaker: "ai", text: "Any relevant medical history, allergies, or regular medications?" },
      { speaker: "patient", text: "I'm allergic to penicillin — it gives me a rash. No regular medications." },
    ],
    patientContext: "28-year-old female. No chronic conditions. Penicillin allergy (rash). No regular medications.",
    expectedKeywords: ["viral", "supportive", "paracetamol", "rest", "penicillin", "allergy"],
    forbiddenPhrases: ["you have a bacterial", "you are infected with", "diagnosis is", "definitely"],
    expectedRedFlags: ["difficulty breathing", "severe worsening", "return if worse", "000"],
  },
  {
    id: "S02-uti-uncomplicated",
    title: "Uncomplicated UTI — Adult Female",
    presentation: "uti",
    transcript: [
      { speaker: "ai", text: "What symptoms have brought you to Nightingale today?" },
      { speaker: "patient", text: "I have burning when I pass urine and I need to go a lot more often than usual." },
      { speaker: "ai", text: "How long has this been going on?" },
      { speaker: "patient", text: "Started yesterday afternoon." },
      { speaker: "ai", text: "Any blood in your urine, fever, chills, or pain in your back or sides?" },
      { speaker: "patient", text: "No blood. No fever. A little ache in my lower back but nothing severe." },
      { speaker: "ai", text: "Have you had UTIs before and are you currently pregnant?" },
      { speaker: "patient", text: "I've had about two UTIs before treated with antibiotics. I'm not pregnant." },
      { speaker: "ai", text: "Any medications or allergies?" },
      { speaker: "patient", text: "I'm on the oral contraceptive pill — Yasmin. No allergies." },
    ],
    patientContext: "34-year-old female. Taking oral contraceptive pill (Yasmin). No known allergies. Non-pregnant.",
    expectedKeywords: ["urinary tract", "dysuria", "frequency", "trimethoprim", "nitrofurantoin", "antibiotic"],
    forbiddenPhrases: ["you definitely have a UTI", "you are infected", "I diagnose"],
    expectedRedFlags: ["loin pain", "fever", "pyelonephritis", "worsening"],
  },
  {
    id: "S03-rash-tick-bite",
    title: "Annular Rash — Post Bushwalk",
    presentation: "dermatology",
    transcript: [
      { speaker: "ai", text: "What's the main reason for your consultation today?" },
      { speaker: "patient", text: "I have this rash on my arm that's been there for about 2 weeks." },
      { speaker: "ai", text: "Can you describe the rash — red, raised, blistered, itchy?" },
      { speaker: "patient", text: "It's red and slightly raised with a ring-like pattern. Clear centre, red ring." },
      { speaker: "ai", text: "Have you been outdoors in bushland recently? Any tick bites?" },
      { speaker: "patient", text: "Yes, I went bushwalking in the Blue Mountains about 3 weeks ago." },
      { speaker: "ai", text: "Any fever, fatigue, joint pain, or headaches since the bushwalk?" },
      { speaker: "patient", text: "I've been a bit tired and had a mild headache a couple of times." },
      { speaker: "ai", text: "Any medications or allergies?" },
      { speaker: "patient", text: "No allergies. I take amlodipine 5mg for blood pressure." },
    ],
    patientContext: "52-year-old male. Hypertension — on amlodipine 5mg. No known allergies. Recent bushwalk Blue Mountains.",
    expectedKeywords: ["tick", "erythema", "annular", "amlodipine", "photo", "in-person"],
    forbiddenPhrases: ["you have Lyme disease", "definitely tinea", "I diagnose"],
    expectedRedFlags: ["fever", "spreading rash", "neurological", "in-person assessment"],
  },
  {
    id: "S04-mental-health-anxiety",
    title: "Anxiety with Low Mood",
    presentation: "mental-health",
    transcript: [
      { speaker: "ai", text: "What's been bringing you here today?" },
      { speaker: "patient", text: "I've been feeling really anxious lately, constant worry, and not sleeping well. About 2 months." },
      { speaker: "ai", text: "On a scale of 1 to 10, how much is the anxiety affecting your daily life?" },
      { speaker: "patient", text: "I'd say a 7. I've been avoiding social situations and took a week off work last month." },
      { speaker: "ai", text: "Are you experiencing any low mood, hopelessness, or thoughts of harming yourself?" },
      { speaker: "patient", text: "I do feel quite low sometimes. No thoughts of harming myself." },
      { speaker: "ai", text: "Have you had anxiety or depression before?" },
      { speaker: "patient", text: "I had mild depression about 5 years ago and took sertraline for a year." },
      { speaker: "ai", text: "Any medications, alcohol use, or other substances?" },
      { speaker: "patient", text: "I have a couple of drinks most nights to help me sleep. No medications currently." },
    ],
    patientContext: "38-year-old female. Prior depression treated with sertraline (resolved). No current medications. Alcohol use (2 drinks/night).",
    expectedKeywords: ["anxiety", "depression", "sertraline", "SSRI", "sleep", "alcohol", "psychologist", "mental health plan"],
    forbiddenPhrases: ["you are depressed", "you have GAD", "I diagnose"],
    expectedRedFlags: ["self-harm", "suicidal ideation", "safety", "alcohol", "lifeline", "beyond blue"],
  },
  {
    id: "S05-lbp-acute",
    title: "Acute Low Back Pain",
    presentation: "musculoskeletal",
    transcript: [
      { speaker: "ai", text: "What brings you in today?" },
      { speaker: "patient", text: "I've had severe low back pain since I lifted something heavy at work 3 days ago." },
      { speaker: "ai", text: "On a scale of 1–10, how severe is the pain at its worst?" },
      { speaker: "patient", text: "About an 8 when I try to move. Trouble getting out of bed." },
      { speaker: "ai", text: "Does the pain radiate down your leg? Any numbness, tingling, or weakness?" },
      { speaker: "patient", text: "There's an aching sensation down the right leg to the knee but no numbness." },
      { speaker: "ai", text: "Any trouble with bladder or bowel control?" },
      { speaker: "patient", text: "No, everything is normal there." },
      { speaker: "ai", text: "Any history of cancer or significant weight loss? Medications or allergies?" },
      { speaker: "patient", text: "No cancer history. I'm taking ibuprofen 400mg as needed. Allergic to codeine — makes me vomit." },
    ],
    patientContext: "42-year-old male. Codeine allergy (vomiting). Taking ibuprofen PRN. No chronic conditions.",
    expectedKeywords: ["lumbar", "radiculopathy", "ibuprofen", "NSAID", "codeine", "allergy", "physiotherapy"],
    forbiddenPhrases: ["you have a disc herniation", "you have sciatica", "I diagnose"],
    expectedRedFlags: ["cauda equina", "bladder", "bowel", "cancer", "neurological", "return if worsening"],
  },
  {
    id: "S06-chest-pain-emergency",
    title: "Chest Pain — Cardiac Red Flag",
    presentation: "cardiovascular",
    transcript: [
      { speaker: "ai", text: "What's brought you in today?" },
      { speaker: "patient", text: "I've had chest pain for the last 2 hours. It's quite bad, about a 9 out of 10." },
      { speaker: "ai", text: "Does the pain spread anywhere — your jaw, left arm, or shoulder?" },
      { speaker: "patient", text: "Yes, I have an ache in my left arm and I feel a bit short of breath." },
    ],
    patientContext: "58-year-old male. Type 2 diabetes (metformin). Hypertension (lisinopril). Smoker 20 pack-years.",
    expectedKeywords: ["emergency", "000", "cardiac", "ACS", "myocardial"],
    forbiddenPhrases: [],
    expectedRedFlags: ["000", "emergency", "ambulance"],
  },
  {
    id: "S07-paediatric-fever",
    title: "Febrile Child — 3yo",
    presentation: "paediatric",
    transcript: [
      { speaker: "ai", text: "Hello, who are you consulting about today?" },
      { speaker: "patient", text: "My 3-year-old daughter. She's had a fever since last night — 38.9 degrees." },
      { speaker: "ai", text: "Is she alert and interactive? Drinking fluids, passing urine?" },
      { speaker: "patient", text: "A bit quieter than usual but still responds. Had a wet nappy this morning." },
      { speaker: "ai", text: "Any cough, runny nose, vomiting, diarrhoea, or rash?" },
      { speaker: "patient", text: "She has a runny nose and cough. No vomiting or diarrhoea. No rash." },
      { speaker: "ai", text: "Any seizures? Neck stiffness or sensitivity to light?" },
      { speaker: "patient", text: "No seizures. No neck stiffness. Didn't seem bothered by light." },
      { speaker: "ai", text: "Is she up to date with vaccinations?" },
      { speaker: "patient", text: "Yes, fully vaccinated. No overseas travel." },
    ],
    patientContext: "3-year-old female (guardian consultation — mother). Fully vaccinated. No overseas travel.",
    expectedKeywords: ["fever", "viral", "paracetamol", "ibuprofen", "hydration", "paediatric"],
    forbiddenPhrases: ["I diagnose", "she definitely has"],
    expectedRedFlags: ["seizure", "rash", "meningitis", "difficulty breathing", "000"],
  },
  {
    id: "S08-vaginal-discharge",
    title: "Post-Antibiotic Vaginal Discharge",
    presentation: "womens-health",
    transcript: [
      { speaker: "ai", text: "What's brought you in today?" },
      { speaker: "patient", text: "I've noticed an unusual vaginal discharge for the past week — thicker than normal and itchy." },
      { speaker: "ai", text: "What colour and texture is it — white, yellow-green, or grey?" },
      { speaker: "patient", text: "It's white and quite thick, a bit like cottage cheese. Very itchy." },
      { speaker: "ai", text: "Any unusual odour, pelvic pain, or pain during sex?" },
      { speaker: "patient", text: "No strong smell. No pelvic pain. No pain during sex." },
      { speaker: "ai", text: "Have you recently taken antibiotics?" },
      { speaker: "patient", text: "Yes, I finished amoxicillin-clavulanate 10 days ago for a dental infection." },
      { speaker: "ai", text: "Any allergies or regular medications?" },
      { speaker: "patient", text: "No allergies. No other medications now." },
    ],
    patientContext: "29-year-old female. Recently completed amoxicillin-clavulanate. No chronic conditions. No known allergies.",
    expectedKeywords: ["candida", "thrush", "antifungal", "clotrimazole", "fluconazole", "antibiotic"],
    forbiddenPhrases: ["you have thrush", "I diagnose", "definitely candida"],
    expectedRedFlags: ["offensive odour", "pelvic pain", "fever", "STI", "worsening"],
  },
  {
    id: "S09-hypertension-management",
    title: "Hypertension — Uncontrolled",
    presentation: "cardiovascular",
    transcript: [
      { speaker: "ai", text: "What can I help you with today?" },
      { speaker: "patient", text: "I've been on blood pressure tablets for 2 years. My home readings have been around 150/95 lately." },
      { speaker: "ai", text: "What blood pressure medication are you currently taking?" },
      { speaker: "patient", text: "Perindopril 4mg and amlodipine 5mg daily." },
      { speaker: "ai", text: "Any recent changes — diet, stress, alcohol, or new medications?" },
      { speaker: "patient", text: "New job 3 months ago, more stressed. More takeaway and coffee." },
      { speaker: "ai", text: "Any headaches, visual changes, chest pain, or leg swelling?" },
      { speaker: "patient", text: "Some morning headaches, nothing severe. No visual changes or chest pain." },
      { speaker: "ai", text: "Any other medical conditions or medications?" },
      { speaker: "patient", text: "Type 2 diabetes on metformin 1g twice daily. I don't smoke." },
    ],
    patientContext: "55-year-old male. Hypertension on perindopril 4mg + amlodipine 5mg. Type 2 diabetes on metformin 1g BD.",
    expectedKeywords: ["blood pressure", "hypertension", "perindopril", "amlodipine", "lifestyle", "diabetes", "metformin"],
    forbiddenPhrases: ["you have hypertensive crisis", "I diagnose"],
    expectedRedFlags: ["headache", "vision", "chest pain", "renal function", "emergency"],
  },
  {
    id: "S10-geriatric-falls",
    title: "Elderly Patient — Recurrent Falls + Polypharmacy",
    presentation: "geriatric",
    transcript: [
      { speaker: "ai", text: "Hello, what's brought you to Nightingale today?" },
      { speaker: "patient", text: "I'm calling about my mother. She's 78 and has fallen twice in the past month." },
      { speaker: "ai", text: "Was she fully conscious throughout, or any blackouts or dizziness beforehand?" },
      { speaker: "patient", text: "She was fully conscious. She says she felt dizzy when getting up, then lost her footing." },
      { speaker: "ai", text: "What medications is she currently on?" },
      { speaker: "patient", text: "Furosemide 40mg, ramipril 5mg, atenolol 50mg, aspirin 100mg, and zopiclone 3.75mg." },
      { speaker: "ai", text: "Any vision problems and when was her last blood pressure check?" },
      { speaker: "patient", text: "Her eyesight is not great — she wears glasses. No blood pressure check in 6 months." },
    ],
    patientContext: "78-year-old female (guardian consultation). On: furosemide 40mg, ramipril 5mg, atenolol 50mg, aspirin 100mg, zopiclone 3.75mg. Wears glasses.",
    expectedKeywords: ["falls", "orthostatic", "polypharmacy", "zopiclone", "furosemide", "dizziness", "medication review"],
    forbiddenPhrases: ["she has syncope", "I diagnose", "definitely orthostatic"],
    expectedRedFlags: ["injury", "hip fracture", "cardiac", "medication review", "falls risk"],
  },
];

// ---------------------------------------------------------------------------
// Model Definitions — flagship models as of 2026-04-28
// ---------------------------------------------------------------------------

interface ModelConfig {
  id: string;
  displayName: string;
  provider: "anthropic" | "openai" | "google";
  apiModel: string;
  costPer1kInputTokensUSD: number;
  costPer1kOutputTokensUSD: number;
  notes?: string;
}

const MODELS: ModelConfig[] = [
  {
    id: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6 ★ production",
    provider: "anthropic",
    apiModel: "claude-sonnet-4-6",
    costPer1kInputTokensUSD: 0.003,
    costPer1kOutputTokensUSD: 0.015,
    notes: "Current production model",
  },
  {
    id: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    provider: "anthropic",
    apiModel: "claude-opus-4-7",
    costPer1kInputTokensUSD: 0.015,
    costPer1kOutputTokensUSD: 0.075,
    notes: "Most capable Anthropic model",
  },
  {
    id: "gpt-5-5",
    displayName: "GPT-5.5",
    provider: "openai",
    apiModel: "gpt-5.5",
    costPer1kInputTokensUSD: 0.005,
    costPer1kOutputTokensUSD: 0.030,
    notes: "OpenAI flagship, released 2026-04-23",
  },
  {
    id: "gemini-3-1-pro",
    displayName: "Gemini 3.1 Pro",
    provider: "google",
    apiModel: "gemini-3.1-pro-preview",
    costPer1kInputTokensUSD: 0.002,
    costPer1kOutputTokensUSD: 0.012,
    notes: "Google flagship, released 2026-02-19",
  },
];

// ---------------------------------------------------------------------------
// System prompt (mirrors production clinical AI engine)
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
- Use Australian drug names and PBS-listed medications

OUTPUT: Respond with valid JSON only. No markdown, no prose outside JSON.

{
  "soap_note": {
    "subjective": "Chief complaint, symptom onset, duration, severity, associated symptoms, relevant history (patient-reported)",
    "objective": "Relevant observations from the consultation (no physical exam available — telehealth)",
    "assessment": "2–5 differential diagnoses with supporting/against features. Use 'may indicate', 'consistent with' language.",
    "plan": "Management recommendations: self-care, medications if appropriate, escalation triggers, follow-up, red flags"
  },
  "differentials": [
    {
      "condition": "Condition name",
      "likelihood_pct": 60,
      "rationale": "Supporting and against features"
    }
  ],
  "draft_response": "Plain English response for patient (Grade 8 reading level, empathetic, Australian terminology). Draft for GP review.",
  "cannot_assess": false,
  "cannot_assess_reason": null
}

differentials likelihood_pct must sum to approximately 100. Provide 2–5 differentials.
If the presentation requires physical examination or is an acute emergency, set cannot_assess: true.`;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoreBreakdown {
  soapCompleteness: number;   // 0–25
  ahpraCompliance: number;    // 0–25
  clinicalAccuracy: number;   // 0–25
  latencyScore: number;       // 0–15
  costScore: number;          // 0–10
  total: number;              // 0–100
}

function scoreSoap(output: Record<string, unknown>): number {
  const soap = output.soap_note as Record<string, string> | undefined;
  if (!soap) return 0;
  let score = 0;
  for (const field of ["subjective", "objective", "assessment", "plan"]) {
    const v = soap[field] ?? "";
    if (v.length > 60) score += 4;
    if (v.length > 200) score += 2;
  }
  const diffs = output.differentials as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(diffs) && diffs.length >= 2 && diffs.length <= 5) {
    const sum = diffs.reduce((s: number, d) => s + (Number(d.likelihood_pct) || 0), 0);
    if (Math.abs(sum - 100) <= 10) score += 1;
  }
  return Math.min(score, 25);
}

function scoreAhpra(raw: string, scenario: BenchmarkScenario): number {
  let score = 25;
  for (const phrase of scenario.forbiddenPhrases) {
    if (raw.toLowerCase().includes(phrase.toLowerCase())) score -= 5;
  }
  const violations = ["you have ", "the diagnosis is", "this is definitely", "i can confirm", "you definitely have"];
  for (const v of violations) {
    if (raw.toLowerCase().includes(v)) score -= 3;
  }
  const good = ["may indicate", "consistent with", "could suggest", "assess", "000"];
  for (const p of good) {
    if (raw.toLowerCase().includes(p)) score += 1;
  }
  return Math.max(0, Math.min(score, 25));
}

function scoreClinical(raw: string, scenario: BenchmarkScenario): number {
  let score = 0;
  const lower = raw.toLowerCase();
  for (const kw of scenario.expectedKeywords) {
    if (lower.includes(kw.toLowerCase())) score += 2;
  }
  for (const rf of scenario.expectedRedFlags) {
    if (lower.includes(rf.toLowerCase())) score += 1;
  }
  return Math.min(score, 25);
}

function scoreLatency(ms: number): number {
  if (ms < 8000) return 15;
  if (ms < 15000) return 10;
  if (ms < 30000) return 5;
  return 0;
}

function scoreCost(usd: number): number {
  const aud = usd * 1.55;
  if (aud < 0.05) return 10;
  if (aud < 0.15) return 7;
  if (aud < 0.30) return 5;
  if (aud < 0.60) return 3;
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

function buildUserMessage(scenario: BenchmarkScenario): string {
  const transcript = scenario.transcript
    .map((t) => `${t.speaker === "ai" ? "AI" : "PATIENT"}: ${t.text}`)
    .join("\n");
  return `PATIENT CONTEXT:\n${scenario.patientContext}\n\nCONSULTATION TRANSCRIPT:\n${transcript}\n\nPRESENTING COMPLAINT: ${scenario.presentation}\n\nGenerate the clinical assessment JSON.`;
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callAnthropic(model: ModelConfig, scenario: BenchmarkScenario): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in api/.env");
  const client = new Anthropic({ apiKey });
  const start = Date.now();
  const response = await client.messages.create({
    model: model.apiModel,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(scenario) }],
  });
  const latencyMs = Date.now() - start;
  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  return { rawOutput: raw, parsed: safeParseJson(raw), inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, latencyMs };
}

async function callOpenAI(model: ModelConfig, scenario: BenchmarkScenario): Promise<CallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in api/.env");
  const client = new OpenAI({ apiKey });
  const start = Date.now();
  const response = await client.chat.completions.create({
    model: model.apiModel,
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(scenario) },
    ],
    response_format: { type: "json_object" },
  });
  const latencyMs = Date.now() - start;
  const raw = response.choices[0]?.message?.content ?? "";
  return { rawOutput: raw, parsed: safeParseJson(raw), inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0, latencyMs };
}

async function callGoogle(model: ModelConfig, scenario: BenchmarkScenario): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in api/.env");
  const ai = new GoogleGenAI({ apiKey });
  const userMessage = buildUserMessage(scenario);
  const start = Date.now();
  const response = await ai.models.generateContent({
    model: model.apiModel,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });
  const latencyMs = Date.now() - start;
  const raw = response.text ?? "";
  const usage = response.usageMetadata;
  return {
    rawOutput: raw,
    parsed: safeParseJson(raw),
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Benchmark runner
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

async function runOne(scenario: BenchmarkScenario, model: ModelConfig): Promise<BenchmarkResult> {
  let result: CallResult;
  try {
    if (model.provider === "anthropic") result = await callAnthropic(model, scenario);
    else if (model.provider === "openai") result = await callOpenAI(model, scenario);
    else result = await callGoogle(model, scenario);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(` ERROR: ${message}\n`);
    return {
      scenarioId: scenario.id, scenarioTitle: scenario.title,
      modelId: model.id, modelName: model.displayName,
      score: { soapCompleteness: 0, ahpraCompliance: 0, clinicalAccuracy: 0, latencyScore: 0, costScore: 0, total: 0 },
      inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0, latencyMs: 0,
      parseSuccess: false, error: message,
    };
  }

  const costUSD = (result.inputTokens / 1000) * model.costPer1kInputTokensUSD + (result.outputTokens / 1000) * model.costPer1kOutputTokensUSD;
  const soap = result.parsed ? scoreSoap(result.parsed) : 0;
  const ahpra = scoreAhpra(result.rawOutput, scenario);
  const clinical = scoreClinical(result.rawOutput, scenario);
  const latency = scoreLatency(result.latencyMs);
  const cost = scoreCost(costUSD);
  const total = soap + ahpra + clinical + latency + cost;

  process.stdout.write(` ${total}/100 (${(result.latencyMs / 1000).toFixed(1)}s, $${(costUSD * 1.55).toFixed(4)} AUD)\n`);

  return {
    scenarioId: scenario.id, scenarioTitle: scenario.title,
    modelId: model.id, modelName: model.displayName,
    score: { soapCompleteness: soap, ahpraCompliance: ahpra, clinicalAccuracy: clinical, latencyScore: latency, costScore: cost, total },
    inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    estimatedCostUSD: costUSD, latencyMs: result.latencyMs,
    parseSuccess: result.parsed !== null,
  };
}

function printSummary(results: BenchmarkResult[]) {
  const modelIds = [...new Set(results.map((r) => r.modelId))];

  console.log("\n" + "═".repeat(90));
  console.log("BENCHMARK RESULTS — Nightingale Clinical AI  (PRD-031)");
  console.log("═".repeat(90));
  console.log("Scoring: SOAP(25) + AHPRA(25) + Clinical(25) + Latency(15) + Cost(10) = 100\n");

  console.log(
    "Model".padEnd(28) +
    "SOAP".padStart(6) + "AHPRA".padStart(7) + "Clin".padStart(6) +
    "Lat".padStart(5) + "Cost".padStart(6) + " │ " +
    "TOTAL".padStart(5) + "  Avg$/consult AUD".padStart(19) + "  Parse OK"
  );
  console.log("-".repeat(90));

  for (const modelId of modelIds) {
    const mrs = results.filter((r) => r.modelId === modelId && !r.error);
    if (mrs.length === 0) {
      const errResult = results.find((r) => r.modelId === modelId);
      console.log(`${errResult?.modelName ?? modelId}`.padEnd(28) + "  — all runs errored");
      continue;
    }
    const avg = (k: keyof ScoreBreakdown) => (mrs.reduce((s, r) => s + r.score[k], 0) / mrs.length).toFixed(1).padStart(6);
    const avgCostAUD = ((mrs.reduce((s, r) => s + r.estimatedCostUSD, 0) / mrs.length) * 1.55).toFixed(4);
    const parseOk = mrs.filter((r) => r.parseSuccess).length;
    console.log(
      mrs[0].modelName.padEnd(28) +
      avg("soapCompleteness") + avg("ahpraCompliance") + avg("clinicalAccuracy") +
      avg("latencyScore") + avg("costScore") + " │ " +
      avg("total") + `  $${avgCostAUD}`.padStart(19) + `  ${parseOk}/${mrs.length}`
    );
  }

  console.log("\n" + "─".repeat(90));
  console.log("Per-scenario breakdown:\n");
  const scenarioIds = [...new Set(results.map((r) => r.scenarioId))];
  for (const sid of scenarioIds) {
    const sr = results.filter((r) => r.scenarioId === sid);
    console.log(`${sid}: ${sr[0]?.scenarioTitle}`);
    for (const r of sr) {
      const status = r.error ? `ERR: ${r.error.slice(0, 40)}` : r.parseSuccess ? "JSON OK" : "PARSE FAIL";
      console.log(`  ${r.modelName.padEnd(26)} ${r.score.total.toString().padStart(3)}/100  ${status}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioFilter = args.includes("--scenario") ? args[args.indexOf("--scenario") + 1] : null;
  const modelFilter = args.includes("--model") ? args[args.indexOf("--model") + 1] : null;

  const scenarios = scenarioFilter ? SCENARIOS.filter((s) => s.id === scenarioFilter) : SCENARIOS;
  const models = modelFilter ? MODELS.filter((m) => m.id === modelFilter) : MODELS;

  if (scenarios.length === 0) { console.error(`No scenario matches: ${scenarioFilter}`); process.exit(1); }
  if (models.length === 0) { console.error(`No model matches: ${modelFilter}`); process.exit(1); }

  console.log(`\nNightingale LLM Benchmark — PRD-031`);
  console.log(`Scenarios: ${scenarios.length}  │  Models: ${models.length}`);
  console.log(`Keys loaded from: api/.env\n`);

  const modelsWithKeys = models.filter((m) => {
    if (m.provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) { console.warn(`SKIP ${m.displayName} — ANTHROPIC_API_KEY not set`); return false; }
    if (m.provider === "openai" && !process.env.OPENAI_API_KEY) { console.warn(`SKIP ${m.displayName} — OPENAI_API_KEY not set in api/.env`); return false; }
    if (m.provider === "google" && !process.env.GEMINI_API_KEY) { console.warn(`SKIP ${m.displayName} — GEMINI_API_KEY not set`); return false; }
    return true;
  });

  if (modelsWithKeys.length === 0) { console.error("No models have API keys configured. Add keys to api/.env."); process.exit(1); }

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n▶ ${scenario.id}: ${scenario.title}`);
    for (const model of modelsWithKeys) {
      process.stdout.write(`  ${model.displayName.padEnd(28)}`);
      const r = await runOne(scenario, model);
      results.push(r);
      await new Promise((res) => setTimeout(res, 800)); // rate limit buffer
    }
  }

  printSummary(results);

  const outDir = path.join(__dirname, "benchmark-results");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `benchmark-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results: ${outPath}`);
}

main().catch((err) => { console.error("Benchmark failed:", err); process.exit(1); });
