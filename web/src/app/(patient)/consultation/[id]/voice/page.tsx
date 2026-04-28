"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConsultationSocket, TranscriptEvent, SessionNotes } from "@/lib/consultation-ws";
import { getStreamToken, getToken } from "@/lib/api";
import ConsultationStepper from "@/components/ConsultationStepper";

interface Turn {
  role: "patient" | "assistant";
  text: string;
}

// Gemini Live sends PCM16 mono at 24 kHz
const GEMINI_AUDIO_SAMPLE_RATE = 24000;

const EMPTY_NOTES: SessionNotes = {
  symptoms: [],
  duration: null,
  severity: null,
  medications: [],
  allergies: [],
  conditions: [],
};

function hasNotes(notes: SessionNotes): boolean {
  return (
    notes.symptoms.length > 0 ||
    notes.duration !== null ||
    notes.severity !== null ||
    notes.medications.length > 0 ||
    notes.allergies.length > 0 ||
    notes.conditions.length > 0
  );
}

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
  const [sessionNotes, setSessionNotes] = useState<SessionNotes>(EMPTY_NOTES);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const socketRef = useRef<ConsultationSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Audio playback — scheduled gapless playback of PCM16 chunks from Gemini
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const pendingSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Keep a ref in sync with muted state so the onaudioprocess closure always
  // sees the current value (closures over state capture the initial value only).
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Stop all scheduled audio sources and reset the playback queue.
  // Called on barge-in interruption so the old AI utterance doesn't keep
  // playing in the background while a new one starts.
  const clearAudioQueue = useCallback(() => {
    for (const src of pendingSourcesRef.current) {
      try { src.stop(); } catch { /* already ended */ }
    }
    pendingSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

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

    // Track so we can stop on barge-in
    pendingSourcesRef.current.push(source);
    source.onended = () => {
      pendingSourcesRef.current = pendingSourcesRef.current.filter((s) => s !== source);
    };
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
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        // ScriptProcessorNode requires its output to be connected for
        // onaudioprocess to fire reliably. Route through a muted gain node
        // so the audio graph stays alive without echoing the mic to speakers.
        const muteGain = ctx.createGain();
        muteGain.gain.value = 0;
        src.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(ctx.destination);
        processor.onaudioprocess = (e) => {
          if (mutedRef.current) return;
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
            // User started speaking — stop all queued AI audio immediately so
            // the old utterance doesn't overlap the new response.
            clearAudioQueue();
          },
          onEmergency: () => setIsEmergency(true),
          onSessionNotes: (notes) => {
            setSessionNotes(notes);
            // Auto-expand the notes panel on first note captured
            setNotesExpanded(true);
          },
          onError: () => {
            if (!cancelled) setConnectError("Could not connect to session. Please go back and try again.");
          },
          onEnded: () => {
            // Tear down mic and audio before navigating so nothing lingers
            clearAudioQueue();
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            socketRef.current?.disconnect();
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
      clearAudioQueue();
      socketRef.current?.disconnect();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      playbackCtxRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  function handleEnd() {
    if (ended) return;
    socketRef.current?.endSession();
    socketRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setEnded(true);
    router.push(`/consultation/${id}/photos`);
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const notesCaptured = hasNotes(sessionNotes);

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

      {/* Real-time session notes panel (PRD-029) */}
      {notesCaptured && (
        <div className="mx-4 mb-3 rounded-xl border border-secondary/30 bg-white/5 overflow-hidden">
          <button
            onClick={() => setNotesExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 font-label-sm text-secondary text-xs uppercase tracking-widest font-semibold">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
              Notes captured
            </span>
            <span className="material-symbols-outlined text-white/40 text-sm">
              {notesExpanded ? "expand_less" : "expand_more"}
            </span>
          </button>

          {notesExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {sessionNotes.symptoms.length > 0 && (
                <NoteRow icon="symptoms" label="Symptoms" items={sessionNotes.symptoms} />
              )}
              {sessionNotes.duration && (
                <NoteRow icon="schedule" label="Duration" items={[sessionNotes.duration]} />
              )}
              {sessionNotes.severity && (
                <NoteRow icon="vital_signs" label="Severity" items={[sessionNotes.severity]} />
              )}
              {sessionNotes.medications.length > 0 && (
                <NoteRow icon="medication" label="Medications" items={sessionNotes.medications} />
              )}
              {sessionNotes.allergies.length > 0 && (
                <NoteRow icon="warning" label="Allergies" items={sessionNotes.allergies} />
              )}
              {sessionNotes.conditions.length > 0 && (
                <NoteRow icon="medical_information" label="Conditions" items={sessionNotes.conditions} />
              )}
            </div>
          )}
        </div>
      )}

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

function NoteRow({ icon, label, items }: { icon: string; label: string; items: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="material-symbols-outlined text-secondary/60 text-sm mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mr-2">{label}</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {items.map((item) => (
            <span
              key={item}
              className="text-xs bg-secondary/20 text-secondary-fixed-dim border border-secondary/20 rounded-full px-2 py-0.5 capitalize"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
