"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function AudioCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [permission, setPermission] = useState<"idle" | "granted" | "denied">("idle");
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  async function requestMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      setPermission("denied");
    }
  }

  function proceed() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(animFrameRef.current);
    router.push(`/consultation/${id}/voice`);
  }

  const micWorking = level > 5;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-6">
        <Link href="/dashboard" className="font-manrope font-bold text-xl tracking-tighter text-primary">
          Nightingale
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-8">
        <div className="w-full max-w-md text-center">
          {/* Icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors ${
            permission === "granted" && micWorking
              ? "bg-secondary/10"
              : permission === "denied"
              ? "bg-error-container"
              : "bg-surface-container"
          }`}>
            <span className={`material-symbols-outlined text-5xl transition-colors ${
              permission === "granted" && micWorking
                ? "text-secondary"
                : permission === "denied"
                ? "text-on-error-container"
                : "text-on-surface-variant"
            }`} style={permission === "granted" && micWorking ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {permission === "denied" ? "mic_off" : "mic"}
            </span>
          </div>

          <h1 className="font-manrope text-headline-lg text-primary mb-2">Microphone Check</h1>
          <p className="font-body-md text-on-surface-variant mb-8">
            We need access to your microphone for the voice consultation.
          </p>

          {permission === "denied" && (
            <div role="alert" className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl font-body-md text-sm text-left">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                Microphone access was denied. Please allow microphone access in your browser settings and try again.
              </div>
            </div>
          )}

          {permission === "granted" && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 mb-6 text-left">
              <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Microphone Level</p>
              <div className="h-3 bg-surface-container rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-secondary rounded-full transition-all duration-75"
                  style={{ width: `${level}%` }}
                  aria-label="microphone level"
                />
              </div>
              <div className={`flex items-center gap-2 font-clinical-data text-sm ${
                micWorking ? "text-secondary" : "text-on-surface-variant"
              }`}>
                <span className="material-symbols-outlined text-base" style={micWorking ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {micWorking ? "check_circle" : "pending"}
                </span>
                {micWorking ? "Microphone is working" : "Speak to test your microphone"}
              </div>
            </div>
          )}

          {permission === "idle" && (
            <button
              onClick={requestMic}
              className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">mic</span>
              Allow Microphone Access
            </button>
          )}

          {permission === "granted" && (
            <button
              onClick={proceed}
              className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
              Start Consultation
            </button>
          )}

          {permission === "denied" && (
            <button
              onClick={requestMic}
              className="w-full bg-surface-container text-on-surface font-manrope font-bold py-4 rounded-xl hover:bg-surface-container-high transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
