"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConsultation } from "@/lib/api";

export default function NewConsultationPage() {
  const router = useRouter();
  const [complaint, setComplaint] = useState("");
  const [type, setType] = useState<"voice" | "text">("voice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const consultation = await createConsultation(type, complaint || undefined);
      if (type === "voice") {
        router.push(`/consultation/${consultation.id}/audio-check`);
      } else {
        router.push(`/consultation/${consultation.id}/result`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start consultation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-stack-lg max-w-2xl">
      <h1 className="font-display text-headline-lg text-on-surface mb-2">New Consultation</h1>
      <p className="text-on-surface-variant text-body-md mb-8">
        Describe what&apos;s brought you in today and choose how you&apos;d like to consult.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="complaint" className="block text-label-sm text-on-surface-variant mb-1">
            WHAT BRINGS YOU IN TODAY?
          </label>
          <textarea
            id="complaint"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full border-2 border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-none"
            placeholder="Describe your symptoms, when they started, and anything else relevant…"
          />
        </div>

        <div>
          <p className="text-label-sm text-on-surface-variant mb-3">CONSULTATION TYPE</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${type === "voice" ? "border-secondary bg-secondary-container" : "border-outline-variant"}`}>
              <input
                id="voice"
                type="radio"
                name="type"
                value="voice"
                checked={type === "voice"}
                onChange={() => setType("voice")}
                className="sr-only"
              />
              <span className="font-semibold text-on-surface">Voice</span>
              <span className="text-clinical-data text-on-surface-variant">Recommended · Faster</span>
            </label>

            <label className={`flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${type === "text" ? "border-secondary bg-secondary-container" : "border-outline-variant"}`}>
              <input
                id="text"
                type="radio"
                name="type"
                value="text"
                checked={type === "text"}
                onChange={() => setType("text")}
                className="sr-only"
              />
              <span className="font-semibold text-on-surface">Text</span>
              <span className="text-clinical-data text-on-surface-variant">Type your responses</span>
            </label>
          </div>
        </div>

        <div className="bg-surface-container rounded-lg p-4 flex items-start gap-3">
          <span className="text-secondary text-xl">💰</span>
          <div>
            <p className="font-semibold text-on-surface">$50 AUD · Doctor-reviewed</p>
            <p className="text-clinical-data text-on-surface-variant">Full refund if we cannot assess your condition remotely.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Starting…" : "Continue to Consultation"}
        </button>
      </form>
    </div>
  );
}
