"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getDoctorConsultation, amendConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";
import DoctorSideNav from "@/components/DoctorSideNav";

export default function AmendPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [aiDraft, setAiDraft] = useState("");
  const [doctorDraft, setDoctorDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoctorConsultation(id).then((c) => {
      const draft = c.aiDraft ?? "";
      setAiDraft(draft);
      setDoctorDraft(draft);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !doctorDraft.trim()) return;
    setSaving(true);
    try {
      await amendConsultation(id, doctorDraft.trim());
      router.push("/doctor/queue");
    } catch (err: unknown) {
      const { title, detail } = err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: err instanceof ApiError ? err.correlationId : undefined });
    } finally {
      setSaving(false);
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
          <span className="font-manrope font-bold text-primary text-sm">Amend Response</span>
        </header>

        {loading ? (
          <div className="mt-16 flex items-center justify-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="mt-16 p-4 md:p-6 max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="font-headline-lg text-headline-lg text-primary">Amend Response</h1>
              <p className="font-body-md text-on-surface-variant mt-1">
                Edit the AI draft below to send a personalised response to the patient.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Original AI draft (read-only) */}
              <div>
                <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Original AI Draft</p>
                <div className="bg-surface-container rounded-xl p-5 font-body-md text-on-surface-variant whitespace-pre-wrap min-h-64 border border-outline-variant/30">
                  {aiDraft || "No draft available"}
                </div>
                <p className="mt-2 font-label-sm text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  Read-only — your changes will not affect the original
                </p>
              </div>

              {/* Editable amendment */}
              <form onSubmit={handleSubmit} className="flex flex-col">
                <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Your Amendment</p>
                <textarea
                  value={doctorDraft}
                  onChange={(e) => setDoctorDraft(e.target.value)}
                  rows={12}
                  className="flex-1 bg-white border-2 border-outline-variant rounded-xl px-4 py-3 font-body-md text-on-surface focus:outline-none focus:border-primary resize-none shadow-card"
                  placeholder="Edit the response to be sent to the patient…"
                />
                <div className="mt-4 space-y-3">
                  <button
                    type="submit"
                    disabled={saving || !doctorDraft.trim()}
                    className="w-full bg-primary text-white rounded-xl py-4 font-manrope font-bold hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    {saving ? "Sending…" : "Send Amended Response"}
                  </button>
                  <Link
                    href={`/doctor/consultation/${id}`}
                    className="w-full flex items-center justify-center border-2 border-outline-variant text-on-surface font-manrope font-bold rounded-xl py-3 hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
