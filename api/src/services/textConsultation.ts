import { GoogleGenAI } from "@google/genai";

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
  history: TextTurn[]
): Promise<AiTextResponse> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const ai = new GoogleGenAI({ apiKey });

  const chatHistory = history.map((t) => ({
    role: t.speaker === "ai" ? ("model" as const) : ("user" as const),
    parts: [{ text: t.text }],
  }));

  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    config: { systemInstruction: SYSTEM_INSTRUCTION },
    history: chatHistory,
  });

  const result = await chat.sendMessage({ message: patientMessage });
  const raw = (result.text ?? "").trim();

  try {
    return JSON.parse(raw) as AiTextResponse;
  } catch {
    return { type: "question", text: raw, options: null };
  }
}
