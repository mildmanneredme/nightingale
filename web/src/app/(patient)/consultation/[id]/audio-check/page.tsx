"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

  return (
    <div className="py-stack-lg max-w-2xl">
      <h1 className="font-display text-headline-lg text-on-surface mb-2">Microphone Check</h1>
      <p className="text-on-surface-variant text-body-md mb-8">
        We need access to your microphone for the voice consultation.
      </p>

      {permission === "denied" && (
        <div role="alert" className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg text-body-md">
          Microphone access was denied. Please allow microphone access in your browser settings and try again.
        </div>
      )}

      {permission === "idle" && (
        <button
          onClick={requestMic}
          className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 mb-4"
        >
          Allow Microphone Access
        </button>
      )}

      {permission === "granted" && (
        <>
          <div className="bg-surface-container rounded-xl p-6 mb-6">
            <p className="text-label-sm text-on-surface-variant mb-3">MICROPHONE LEVEL</p>
            <div className="h-4 bg-outline-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full transition-all duration-75"
                style={{ width: `${level}%` }}
                aria-label="microphone level"
              />
            </div>
            <p className="text-clinical-data text-on-surface-variant mt-2">
              {level > 5 ? "Microphone is working" : "Speak to test your microphone"}
            </p>
          </div>

          <button
            onClick={proceed}
            className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90"
          >
            Start Consultation
          </button>
        </>
      )}
    </div>
  );
}
