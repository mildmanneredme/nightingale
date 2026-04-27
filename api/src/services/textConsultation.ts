import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { recordUsage } from "./llmUsageTracker";

const SYSTEM_INSTRUCTION = `You are a clinical AI assistant conducting a structured patient interview for an Australian telehealth consultation.
Rules:
- Use "assess" never "diagnose"; "may indicate" never "you have [condition]"
- Emergency services: always "000" never "911"
- Ask ONE focused clinical question at a time
- When you have gathered sufficient information (typically 5-8 exchanges), end the interview
- Respond ONLY with valid JSON in one of these shapes:
  {"type":"question","text":"<question>","options":null}
  {"type":"question","text":"<question>","options":["<opt1>","<opt2>"]}
  {"type":"complete","summary":"<clinical summary for doctor review>"}
  {"type":"emergency","message":"<brief instruction to call 000>"}
- Never include anything outside the JSON object`;

export interface TextTurn {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms: number;
}

export interface AiTextResponse {
  type: "question" | "complete" | "emergency";
  text?: string;
  options?: string[] | null;
  summary?: string;
  message?: string;
}

export async function sendTextMessage(
  patientMessage: string,
  history: TextTurn[],
  preContextPrompt?: string,
  consultationId?: string
): Promise<AiTextResponse> {
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const chatHistory = history.map((t) => ({
    role: t.speaker === "ai" ? ("model" as const) : ("user" as const),
    parts: [{ text: t.text }],
  }));

  const systemInstruction = preContextPrompt
    ? `${SYSTEM_INSTRUCTION}\n\n${preContextPrompt}`
    : SYSTEM_INSTRUCTION;

  const chat = ai.chats.create({
    model: config.gemini.chatModel,
    config: { systemInstruction },
    history: chatHistory,
  });

  const result = await chat.sendMessage({ message: patientMessage });
  const raw = (result.text ?? "").trim();

  const usage = result.usageMetadata;
  if (consultationId && usage) {
    void recordUsage({
      consultationId,
      operation: "text_chat",
      provider: "google",
      modelId: config.gemini.chatModel,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    });
  }

  return parseAiResponse(raw);
}

// Gemini occasionally wraps the JSON in ```json … ``` fences despite the
// system instruction. Strip those before parsing, and fall back to extracting
// the first {…} substring so the patient never sees raw JSON in the chat.
export function parseAiResponse(raw: string): AiTextResponse {
  const cleaned = raw
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  const tryParse = (s: string): AiTextResponse | null => {
    try {
      const obj = JSON.parse(s) as AiTextResponse;
      if (obj && typeof obj === "object" && typeof obj.type === "string") return obj;
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryParse(match[0]);
    if (extracted) return extracted;
  }

  return {
    type: "question",
    text: "Sorry, I had trouble understanding that. Could you rephrase?",
    options: null,
  };
}
