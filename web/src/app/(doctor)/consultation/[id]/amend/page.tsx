"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getDoctorConsultation, amendConsultation } from "@/lib/api";

export default function AmendPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [aiDraft, setAiDraft] = useState("");
  const [doctorDraft, setDoctorDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setSaving(true);
    try {
      await amendConsultation(id, doctorDraft.trim());
      router.push("/doctor/queue");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send amendment.");
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

      {error && (
        <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-md text-sm">{error}</div>
      )}

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
