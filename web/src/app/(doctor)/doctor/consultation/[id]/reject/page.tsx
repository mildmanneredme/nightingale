"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { rejectConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";
import DoctorSideNav from "@/components/DoctorSideNav";

const REASON_CODES = [
  { value: "physical_exam_required", label: "Physical exam required" },
  { value: "insufficient_information", label: "Insufficient information" },
  { value: "outside_remote_scope", label: "Outside remote scope" },
  { value: "other", label: "Other (specify below)" },
];

export default function RejectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [reasonCode, setReasonCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !reasonCode) return;
    setSubmitting(true);
    try {
      await rejectConsultation(id, reasonCode, message || undefined);
      router.push("/doctor/queue");
    } catch (err: unknown) {
      const { title, detail } = err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: err instanceof ApiError ? err.correlationId : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-background min-h-screen flex">
      <DoctorSideNav active="queue" />

      <main className="flex-1 min-w-0">
        {/* TopAppBar */}
        <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 h-16 flex items-center gap-4">
          <Link href={`/doctor/consultation/${id}`} className="flex items-center gap-1 text-secondary font-bold text-sm hover:underline">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Review
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-manrope font-bold text-primary text-sm">Reject Consultation</span>
        </header>

        <div className="mt-16 p-4 md:p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="font-manrope text-headline-lg text-primary">Reject Consultation</h1>
            <p className="font-body-md text-on-surface-variant mt-1">
              Select a reason and optionally add a message for the patient. They will receive a full refund.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reason codes */}
            <div>
              <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Rejection Reason</p>
              <div className="space-y-2">
                {REASON_CODES.map((rc) => (
                  <button
                    key={rc.value}
                    type="button"
                    onClick={() => setReasonCode(rc.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors text-left ${
                      reasonCode === rc.value
                        ? "border-error bg-error-container"
                        : "border-outline-variant bg-white hover:border-error/50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      reasonCode === rc.value ? "border-error" : "border-outline"
                    }`}>
                      {reasonCode === rc.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-error" />
                      )}
                    </div>
                    <span className={`font-body-md ${reasonCode === rc.value ? "text-on-error-container font-semibold" : "text-on-surface"}`}>
                      {rc.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom message */}
            <div>
              <label className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-3 block">
                Message to Patient (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Explain next steps to the patient…"
                className="w-full bg-white border-2 border-outline-variant rounded-xl px-4 py-3 font-body-md text-on-surface focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Refund note */}
            <div className="flex items-start gap-3 p-4 bg-secondary-container/20 rounded-xl border border-secondary-container/30">
              <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              <p className="font-body-md text-sm text-on-secondary-container">
                The patient will automatically receive a full refund within 3–5 business days.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/doctor/consultation/${id}`}
                className="flex-1 flex items-center justify-center border-2 border-outline-variant text-on-surface font-manrope font-bold rounded-xl py-4 hover:bg-surface-container transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !reasonCode}
                className="flex-1 bg-error text-white rounded-xl py-4 font-manrope font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                {submitting ? "Processing…" : "Reject Consultation"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
