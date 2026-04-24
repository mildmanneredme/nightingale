"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getDoctorConsultation, approveConsultation, DoctorConsultation } from "@/lib/api";

export default function DoctorConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<DoctorConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoctorConsultation(id).then(setConsultation).finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    try {
      await approveConsultation(id);
      router.push("/doctor/queue");
    } finally {
      setApproving(false);
      setShowConfirm(false);
    }
  }

  if (loading) return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;
  if (!consultation) return <div className="py-stack-lg text-on-surface-variant">Not found.</div>;

  const soap = consultation.soapNote as Record<string, string> | null;

  return (
    <div className="py-stack-lg max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/doctor/queue" className="text-secondary text-body-md hover:opacity-70">← Queue</Link>
        <h1 className="font-display text-headline-md text-on-surface flex-1">Consultation Review</h1>
      </div>

      {/* Chief complaint */}
      <div className="bg-primary text-on-primary rounded-xl p-6">
        <p className="text-label-sm opacity-70 mb-1">CHIEF COMPLAINT</p>
        <p className="text-title-lg font-semibold">{consultation.presentingComplaint ?? "Not recorded"}</p>
      </div>

      {/* Red flags */}
      {consultation.redFlags && consultation.redFlags.length > 0 && (
        <div className="bg-error-container rounded-xl p-5">
          <p className="text-label-sm text-on-error-container mb-2">RED FLAGS DETECTED</p>
          <ul className="space-y-1">
            {consultation.redFlags.map((f: { phrase: string }, i: number) => (
              <li key={i} className="text-on-error-container text-body-md">⚠ {f.phrase}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SOAP note */}
      {soap && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-semibold text-on-surface text-title-md mb-4">SOAP Note</h2>
          {["subjective", "objective", "assessment", "plan"].map((section) => (
            soap[section] ? (
              <div key={section} className="mb-3">
                <p className="text-label-sm text-on-surface-variant mb-1">{section.toUpperCase()}</p>
                <p className="text-body-md text-on-surface">{soap[section]}</p>
              </div>
            ) : null
          ))}
        </div>
      )}

      {/* Differential diagnoses */}
      {consultation.differentialDiagnoses && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-semibold text-on-surface text-title-md mb-4">Differential Diagnoses</h2>
          <ol className="space-y-2">
            {(consultation.differentialDiagnoses as Array<{ diagnosis: string; rank: number }>).map((d, i) => (
              <li key={i} className="flex items-center gap-3 text-body-md text-on-surface">
                <span className="text-secondary font-mono text-label-sm w-4">{i + 1}.</span>
                {d.diagnosis}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Transcript */}
      {consultation.transcript && consultation.transcript.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h2 className="font-semibold text-on-surface text-title-md mb-4">Transcript</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {consultation.transcript.map((t: { speaker: string; text: string }, i: number) => (
              <div key={i} className={`flex gap-3 text-body-md ${t.speaker === "ai" ? "text-secondary" : "text-on-surface"}`}>
                <span className="text-label-sm text-on-surface-variant w-12 shrink-0 pt-0.5">
                  {t.speaker === "ai" ? "AI" : "Patient"}
                </span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Draft */}
      {consultation.aiDraft && (
        <div className="bg-secondary-container rounded-xl p-6">
          <p className="text-label-sm text-on-secondary-container mb-2">AI DRAFT RESPONSE</p>
          <p className="text-on-secondary-container text-body-md whitespace-pre-wrap">{consultation.aiDraft}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={approving}
          className="bg-secondary text-on-secondary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <Link
          href={`/doctor/consultation/${id}/amend`}
          className="flex items-center justify-center bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90"
        >
          Amend
        </Link>
        <Link
          href={`/doctor/consultation/${id}/reject`}
          className="flex items-center justify-center border-2 border-error text-error rounded-lg py-4 font-semibold text-body-md hover:bg-error-container"
        >
          Reject
        </Link>
      </div>

      {/* Confirm approve dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-gutter">
          <div className="bg-surface rounded-xl p-8 max-w-md w-full shadow-xl">
            <h2 className="font-display text-headline-sm text-on-surface mb-3">Send this response?</h2>
            <p className="text-on-surface-variant text-body-md mb-6">
              Send the AI draft response to the patient as-is. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 bg-secondary text-on-secondary rounded-lg py-3 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
              >
                {approving ? "Sending…" : "Confirm Send"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-outline-variant text-on-surface rounded-lg py-3 font-semibold text-body-md hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
