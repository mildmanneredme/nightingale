"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { rejectConsultation } from "@/lib/api";

const REASON_CODES = [
  { value: "physical_exam_required", label: "Physical exam required" },
  { value: "insufficient_information", label: "Insufficient information" },
  { value: "outside_remote_scope", label: "Outside remote scope" },
  { value: "other", label: "Other (specify below)" },
];

export default function RejectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reasonCode, setReasonCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !reasonCode) return;
    setError(null);
    setSubmitting(true);
    try {
      await rejectConsultation(id, reasonCode, message || undefined);
      router.push("/doctor/queue");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject consultation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="py-stack-lg max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/doctor/consultation/${id}`} className="text-secondary text-body-md hover:opacity-70">← Back</Link>
        <h1 className="font-display text-headline-md text-on-surface">Reject Consultation</h1>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-md text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-3">REJECTION REASON</p>
          <div className="space-y-2">
            {REASON_CODES.map((rc) => (
              <label key={rc.value} className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${reasonCode === rc.value ? "border-error bg-error-container" : "border-outline-variant"}`}>
                <input
                  type="radio"
                  name="reasonCode"
                  value={rc.value}
                  checked={reasonCode === rc.value}
                  onChange={() => setReasonCode(rc.value)}
                  className="sr-only"
                />
                <span className={`text-body-md ${reasonCode === rc.value ? "text-on-error-container font-semibold" : "text-on-surface"}`}>
                  {rc.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-label-sm text-on-surface-variant mb-2">
            CUSTOM MESSAGE TO PATIENT (OPTIONAL)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Explain next steps to the patient…"
            className="w-full border-2 border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !reasonCode}
          className="w-full bg-error text-on-error rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Processing…" : "Reject — Cannot Assess Remotely"}
        </button>
      </form>
    </div>
  );
}
