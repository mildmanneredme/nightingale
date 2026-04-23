"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConsultationSocket, TranscriptEvent } from "@/lib/consultation-ws";
import { endConsultation } from "@/lib/api";

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
          router.push(`/consultation/${id}/result`);
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
  }, [id, router]);

  function handleEnd() {
    socketRef.current?.endSession();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="py-stack-lg max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
      {isEmergency && (
        <div role="alert" className="mb-4 p-4 bg-error-container text-on-error-container rounded-xl">
          <p className="font-semibold text-title-md mb-1">Emergency — Call 000 immediately</p>
          <p className="text-body-md">Our AI has detected a potential emergency. Please call 000 or go to your nearest emergency department now.</p>
          <a href="tel:000" className="inline-block mt-3 bg-error text-on-error font-semibold rounded-lg py-2 px-4">
            Call 000
          </a>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-headline-md text-on-surface">Voice Consultation</h1>
        <span className="font-mono text-on-surface-variant text-body-md">{mins}:{secs}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {turns.length === 0 && (
          <p className="text-on-surface-variant text-body-md text-center py-8">
            Listening… speak naturally about your symptoms.
          </p>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 text-body-md max-w-[85%] ${
              turn.role === "patient"
                ? "ml-auto bg-secondary-container text-on-secondary-container"
                : "bg-surface-container text-on-surface"
            }`}
          >
            {turn.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!ended && (
        <button
          onClick={handleEnd}
          className="w-full bg-error text-on-error rounded-lg py-4 font-semibold text-body-md hover:opacity-90"
        >
          End Consultation
        </button>
      )}
    </div>
  );
}
