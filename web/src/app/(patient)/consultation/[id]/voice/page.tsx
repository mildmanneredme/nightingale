"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConsultationSocket, TranscriptEvent } from "@/lib/consultation-ws";
import { endConsultation } from "@/lib/api";
import ConsultationStepper from "@/components/ConsultationStepper";

interface Turn {
  role: "patient" | "assistant";
  text: string;
}

export default function VoiceConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const socketRef = useRef<ConsultationSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (!id) return;

    const socket = new ConsultationSocket(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
      id,
      {
        onTranscript: (turn: TranscriptEvent) =>
          setTurns((prev) => [...prev, { role: turn.speaker === "ai" ? "assistant" : "patient", text: turn.text }]),
        onEmergency: () => setIsEmergency(true),
        onEnded: () => {
          setEnded(true);
          router.push(`/consultation/${id}/photos`);
        },
      }
    );
    socketRef.current = socket;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      mediaStreamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      src.connect(processor);
      processor.connect(ctx.destination);
      processor.onaudioprocess = (e) => {
        if (muted) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        const b64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        socket.sendAudio(b64);
      };
    });

    return () => {
      socket.disconnect();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, router, muted]);

  function handleEnd() {
    socketRef.current?.endSession();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#0D1F3C] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="font-manrope font-bold text-xl tracking-tighter text-primary-fixed">Nightingale</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-primary-fixed-dim text-sm">{mins}:{secs}</span>
          <span className="flex items-center gap-1 text-xs text-white/60">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse inline-block" />
            Live
          </span>
        </div>
      </header>

      {/* Progress stepper */}
      <div className="px-6 py-3 border-b border-white/10">
        <ConsultationStepper activeStep={2} variant="dark" />
      </div>

      {/* Emergency banner */}
      {isEmergency && (
        <div role="alert" className="mx-4 mt-4 p-4 bg-error-container text-on-error-container rounded-xl">
          <p className="font-manrope font-bold text-headline-md mb-1">Emergency — Call 000</p>
          <p className="font-body-md mb-3">Our AI has detected a potential emergency. Please call 000 immediately.</p>
          <a href="tel:000" className="inline-flex items-center gap-2 bg-error text-white font-bold rounded-xl py-2 px-4">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
            Call 000
          </a>
        </div>
      )}

      {/* Status */}
      <div className="text-center py-8">
        {/* Animated waveform */}
        <div className="flex items-center justify-center gap-1 mb-4 h-12">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-secondary"
              style={{
                height: muted ? "8px" : `${16 + Math.sin(i * 0.8) * 14}px`,
                animation: muted ? "none" : `wave ${0.8 + i * 0.1}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
        <p className="font-manrope font-semibold text-white mb-1">
          {turns.length === 0 ? "Connecting…" : "Connected to AI Clinical Assistant"}
        </p>
        <p className="font-clinical-data text-white/50 text-xs uppercase tracking-widest">
          {muted ? "Microphone muted" : "Listening — speak naturally"}
        </p>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {turns.length === 0 && (
          <p className="text-white/40 font-body-md text-center py-8">
            Speak naturally about your symptoms…
          </p>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 font-body-md max-w-[85%] ${
              turn.role === "patient"
                ? "ml-auto bg-secondary/30 text-white border border-secondary/30"
                : "bg-white/10 text-white/90"
            }`}
          >
            <p className="font-label-sm text-white/40 uppercase tracking-wider mb-1 text-[10px]">
              {turn.role === "patient" ? "You" : "AI Assistant"}
            </p>
            {turn.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      {!ended && (
        <div className="flex items-center justify-center gap-6 px-6 py-6 border-t border-white/10">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              muted ? "bg-error text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <span className="material-symbols-outlined">{muted ? "mic_off" : "mic"}</span>
          </button>

          <button
            onClick={handleEnd}
            className="w-16 h-16 rounded-full bg-error flex items-center justify-center hover:opacity-90 transition-opacity shadow-xl"
          >
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>call_end</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes wave {
          from { height: 8px; }
          to { height: 36px; }
        }
      `}</style>
    </div>
  );
}
