"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConsultationSocket, TranscriptEvent } from "@/lib/consultation-ws";
import { getStreamToken, getToken } from "@/lib/api";
import ConsultationStepper from "@/components/ConsultationStepper";

interface Turn {
  role: "patient" | "assistant";
  text: string;
}

// Gemini Live sends PCM16 mono at 24 kHz
const GEMINI_AUDIO_SAMPLE_RATE = 24000;

export default function VoiceConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<ConsultationSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Audio playback — scheduled gapless playback of PCM16 chunks from Gemini
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);

  const playAudioChunk = useCallback((base64Data: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume();

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, GEMINI_AUDIO_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const when = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(when);
    nextPlayTimeRef.current = when + buffer.duration;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (!id) return;

    playbackCtxRef.current = new AudioContext();

    let cancelled = false;

    async function startAudioCapture(socket: ConsultationSocket) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;

        const ctx = new AudioContext({ sampleRate: 16000 });
        const src = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        src.connect(processor);
        // Do NOT connect processor to ctx.destination — that routes mic audio to
        // speakers, causing acoustic echo that Gemini hears as a second voice.
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
      } catch {
        if (!cancelled) setConnectError("Microphone access denied. Please allow mic access and try again.");
      }
    }

    async function connect() {
      try {
        const { wsToken } = await getStreamToken(id);
        if (cancelled) return;

        const socket = new ConsultationSocket(id, wsToken, {
          onOpen: () => {
            if (!cancelled) {
              setConnected(true);
              startAudioCapture(socket);
            }
          },
          onTranscript: (turn: TranscriptEvent) =>
            setTurns((prev) => [...prev, {
              role: turn.speaker === "ai" ? "assistant" : "patient",
              text: turn.text,
            }]),
          onAudio: playAudioChunk,
          onInterrupted: () => {
            // User started speaking — reset playback schedule so AI audio stops queuing
            nextPlayTimeRef.current = 0;
          },
          onEmergency: () => setIsEmergency(true),
          onError: () => {
            if (!cancelled) setConnectError("Could not connect to session. Please go back and try again.");
          },
          onEnded: () => {
            setEnded(true);
            router.push(`/consultation/${id}/photos`);
          },
        }, getToken() ?? undefined);
        socketRef.current = socket;
      } catch {
        if (!cancelled) setConnectError("Could not start session. Please go back and try again.");
      }
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      playbackCtxRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  function handleEnd() {
    socketRef.current?.endSession();
    socketRef.current?.disconnect();
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

      {/* Connection error */}
      {connectError && (
        <div role="alert" className="mx-4 mt-4 p-4 bg-error-container text-on-error-container rounded-xl">
          <p className="font-manrope font-bold mb-1">Connection Failed</p>
          <p className="font-body-md">{connectError}</p>
        </div>
      )}

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
          {!connected ? "Connecting…" : "Connected to AI Clinical Assistant"}
        </p>
        <p className="font-clinical-data text-white/50 text-xs uppercase tracking-widest">
          {!connected ? "Please wait…" : muted ? "Microphone muted" : "Feel free to discuss your health concerns"}
        </p>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {turns.length === 0 && !connectError && (
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
      {!ended && !connectError && (
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
