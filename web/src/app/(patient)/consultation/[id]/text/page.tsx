"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sendChatMessage, endConsultation } from "@/lib/api";
import Link from "next/link";
import ConsultationStepper from "@/components/ConsultationStepper";

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
  const [patientHasSent, setPatientHasSent] = useState(false);
  const [ending, setEnding] = useState(false);
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
    setPatientHasSent(true);
    setTurns((prev) => [...prev, { role: "patient", text: message }]);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 300));

    try {
      const res = await sendChatMessage(id, message);
      const { aiResponse, status } = res;

      if (status === "emergency_escalated") {
        setIsEmergency(true);
        setTurns((prev) => [...prev, { role: "ai", text: aiResponse.message ?? "Please call 000 immediately.", options: null }]);
      } else if (status === "transcript_ready") {
        setTurns((prev) => [...prev, {
          role: "ai",
          text: "Thank you — I have enough information. A doctor will review your consultation shortly.",
          options: null,
        }]);
        setTimeout(() => router.push(`/consultation/${id}/photos`), 2000);
      } else {
        setTurns((prev) => [...prev, { role: "ai", text: aiResponse.text ?? "", options: aiResponse.options }]);
      }
    } catch {
      setTurns((prev) => [...prev, { role: "ai", text: "Sorry, there was a connection issue. Please try again.", options: null }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="h-14 flex items-center justify-between px-6">
          <Link href="/dashboard" className="font-manrope font-bold text-xl tracking-tighter text-primary">
            Nightingale
          </Link>
          <div className="flex items-center gap-2">
            {!isEmergency && (
              <span className="flex items-center gap-1.5 text-xs font-bold font-manrope text-secondary uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse inline-block" />
                Doctor Review Pending
              </span>
            )}
          </div>
        </div>
        <div className="px-6 pb-3">
          <ConsultationStepper activeStep={2} />
        </div>
      </header>

      {/* Emergency banner */}
      {isEmergency && (
        <div role="alert" className="mt-16 mx-4 mt-20 p-4 bg-error-container text-on-error-container rounded-xl">
          <p className="font-manrope font-bold text-headline-md mb-2">Emergency — Call 000 immediately</p>
          <a href="tel:000" className="inline-flex items-center gap-2 bg-error text-white font-bold rounded-xl py-2 px-4">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
            Call 000
          </a>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-28 pb-32 space-y-4 max-w-2xl mx-auto w-full">
        {turns.map((turn, i) => (
          <div key={i} className={`flex flex-col gap-2 ${turn.role === "patient" ? "items-end" : "items-start"}`}>
            <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest px-1">
              {turn.role === "patient" ? "You" : "AI Assistant"}
            </p>
            <div className={`rounded-2xl px-4 py-3 font-body-md max-w-[85%] ${
              turn.role === "patient"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-white border border-slate-100 shadow-card text-on-surface"
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
                    className="border-2 border-secondary text-secondary rounded-full px-4 py-1.5 font-manrope font-bold text-xs hover:bg-secondary-container disabled:opacity-50 transition-colors"
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
            <div className="bg-white border border-slate-100 shadow-card rounded-2xl px-4 py-3 text-on-surface-variant font-body-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "0.15s" }} />
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Fixed bottom input */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto space-y-2">
          {patientHasSent && !isEmergency && (
            <button
              onClick={async () => {
                if (ending) return;
                setEnding(true);
                try { await endConsultation(id, []); } catch { /* best-effort */ }
                router.push(`/consultation/${id}/result`);
              }}
              disabled={ending || thinking}
              className="w-full border-2 border-outline-variant text-on-surface-variant font-manrope font-bold rounded-xl py-2 text-sm hover:bg-surface-container disabled:opacity-50 transition-colors"
            >
              {ending ? "Finishing…" : "Finish Consultation"}
            </button>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
              disabled={thinking || isEmergency}
              placeholder="Type your response…"
              className="flex-1 bg-surface-container-lowest border-2 border-outline-variant rounded-xl px-4 py-3 font-body-md focus:outline-none focus:border-primary disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || thinking || isEmergency}
              className="bg-primary text-white rounded-xl px-5 font-manrope font-bold hover:bg-primary-container disabled:opacity-50 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
