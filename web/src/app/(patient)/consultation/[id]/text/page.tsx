"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sendChatMessage } from "@/lib/api";

interface Turn {
  role: "patient" | "ai";
  text: string;
  options?: string[] | null;
}

export default function TextConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns([{
      role: "ai",
      text: "Hello, I'm your clinical AI assistant. I'll ask you a few questions about what's brought you in today. What symptoms are you experiencing?",
      options: null,
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function handleSend(message: string) {
    if (!message.trim() || thinking || isEmergency) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "patient", text: message }]);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 300));

    try {
      const res = await sendChatMessage(id, message);
      const { aiResponse, status } = res;

      if (status === "emergency_escalated") {
        setIsEmergency(true);
        setTurns((prev) => [...prev, {
          role: "ai",
          text: aiResponse.message ?? "Please call 000 immediately.",
          options: null,
        }]);
      } else if (status === "transcript_ready") {
        setTurns((prev) => [...prev, {
          role: "ai",
          text: "Thank you — I have enough information to prepare your assessment. A doctor will review your consultation shortly.",
          options: null,
        }]);
        setTimeout(() => router.push(`/consultation/${id}/photos`), 2000);
      } else {
        setTurns((prev) => [...prev, {
          role: "ai",
          text: aiResponse.text ?? "",
          options: aiResponse.options,
        }]);
      }
    } catch {
      setTurns((prev) => [...prev, {
        role: "ai",
        text: "Sorry, there was a connection issue. Please try again.",
        options: null,
      }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] py-4 max-w-2xl">
      {isEmergency && (
        <div role="alert" className="mb-4 p-4 bg-error-container text-on-error-container rounded-xl">
          <p className="font-semibold text-title-md mb-2">Emergency — Call 000 immediately</p>
          <a href="tel:000" className="inline-block bg-error text-on-error font-semibold rounded-lg py-2 px-4 text-body-md">
            Call 000
          </a>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pb-2">
        {turns.map((turn, i) => (
          <div key={i} className={`flex flex-col gap-2 ${turn.role === "patient" ? "items-end" : "items-start"}`}>
            <div className={`rounded-2xl px-4 py-3 text-body-md max-w-[85%] ${
              turn.role === "patient"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-on-surface"
            }`}>
              {turn.text}
            </div>
            {turn.options && turn.options.length > 0 && (
              <div className="flex flex-wrap gap-2 max-w-[85%]">
                {turn.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleSend(opt)}
                    disabled={thinking}
                    className="border border-secondary text-secondary rounded-full px-3 py-1 text-body-md hover:bg-secondary-container disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-start">
            <div className="bg-surface-container rounded-2xl px-4 py-3 text-on-surface-variant text-body-md">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-outline-variant pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
          disabled={thinking || isEmergency}
          placeholder="Type your response…"
          className="flex-1 border-2 border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || thinking || isEmergency}
          className="bg-primary text-on-primary rounded-lg px-4 py-2 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
