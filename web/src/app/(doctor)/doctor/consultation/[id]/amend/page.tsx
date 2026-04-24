"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getDoctorConsultation, amendConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

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

  if (loading) return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;

  return (
    <div className="py-stack-lg max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/doctor/consultation/${id}`} className="text-secondary text-body-md hover:opacity-70">← Back</Link>
        <h1 className="font-display text-headline-md text-on-surface">Amend Response</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-2">ORIGINAL AI DRAFT</p>
          <div className="bg-surface-container rounded-xl p-5 text-on-surface-variant text-body-md whitespace-pre-wrap min-h-64">
            {aiDraft || "No draft available"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <p className="text-label-sm text-on-surface-variant mb-2">YOUR AMENDMENT</p>
          <textarea
            value={doctorDraft}
            onChange={(e) => setDoctorDraft(e.target.value)}
            rows={12}
            className="flex-1 border-2 border-outline-variant rounded-xl px-4 py-3 text-body-md focus:outline-none focus:border-primary resize-none"
          />
          <button
            type="submit"
            disabled={saving || !doctorDraft.trim()}
            className="mt-4 bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Sending…" : "Send Amended Response"}
          </button>
        </form>
      </div>
    </div>
  );
}
