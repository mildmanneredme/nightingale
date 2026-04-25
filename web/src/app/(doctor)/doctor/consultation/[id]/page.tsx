"use client";
import Link from "next/link";
import DoctorSideNav from "@/components/DoctorSideNav";
import { useDoctorConsultation } from "@/hooks/useDoctorConsultation";

export default function DoctorConsultationPage() {
  const {
    id,
    consultation,
    loading,
    approving,
    showConfirm,
    setShowConfirm,
    handleApprove,
    soap,
  } = useDoctorConsultation();

  return (
    <div className="bg-background min-h-screen flex">
      <DoctorSideNav active="queue" />

      <main className="flex-1 min-w-0">
        {/* TopAppBar */}
        <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 h-16 flex items-center gap-4">
          <Link href="/doctor/queue" className="flex items-center gap-1 text-secondary font-bold text-sm hover:underline">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Queue
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-manrope font-bold text-primary text-sm">Consultation Review</span>
        </header>

        {loading ? (
          <div className="mt-16 flex items-center justify-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : !consultation ? (
          <div className="mt-16 flex flex-col items-center justify-center py-24 text-on-surface-variant gap-4">
            <span className="material-symbols-outlined text-5xl">error_outline</span>
            <p>Consultation not found.</p>
            <Link href="/doctor/queue" className="text-secondary font-bold hover:underline">Back to queue</Link>
          </div>
        ) : (
          <div className="mt-16 p-4 md:p-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

              {/* Left: patient info + clinical data */}
              <div className="xl:col-span-3 space-y-4">

                {/* Patient summary card */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-14 h-14 bg-surface-container-high rounded-xl flex items-center justify-center text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-3xl">person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-headline-md text-headline-md text-primary">
                        {consultation.patientName ?? "Anonymous Patient"}
                      </h2>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {consultation.patientDob && (
                          <span className="font-clinical-data text-on-surface-variant">
                            DOB: {consultation.patientDob}
                          </span>
                        )}
                        {consultation.patientSex && (
                          <span className="font-clinical-data text-on-surface-variant capitalize">
                            {consultation.patientSex}
                          </span>
                        )}
                        <span className="font-clinical-data text-on-surface-variant">
                          ID: #{id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded font-bold text-[10px] uppercase ${
                      consultation.consultationType === "voice"
                        ? "bg-blue-50 text-blue-900"
                        : "bg-emerald-50 text-emerald-800"
                    }`}>
                      {consultation.consultationType}
                    </span>
                  </div>

                  {/* Chief complaint */}
                  <div className="bg-surface-container-low rounded-xl p-4">
                    <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Chief Complaint</p>
                    <p className="font-body-md text-on-surface">
                      &ldquo;{consultation.presentingComplaint ?? "Not recorded"}&rdquo;
                    </p>
                  </div>

                  {/* Priority flags */}
                  {(consultation.priorityFlags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(consultation.priorityFlags ?? []).map((flag) => (
                        <span key={flag} className="bg-tertiary-container text-tertiary-fixed px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Red flags */}
                {consultation.redFlags && consultation.redFlags.length > 0 && (
                  <div className="bg-error-container rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-on-error-container" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                      <p className="font-label-sm text-on-error-container uppercase tracking-wider">Red Flags Detected</p>
                    </div>
                    <ul className="space-y-1">
                      {consultation.redFlags.map((f, i) => (
                        <li key={i} className="font-body-md text-on-error-container">
                          {f.phrase}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* SOAP Note */}
                {soap && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
                    <h3 className="font-headline-md text-headline-md text-primary mb-4">SOAP Note</h3>
                    <div className="space-y-4">
                      {["subjective", "objective", "assessment", "plan"].map((section) =>
                        soap[section] ? (
                          <div key={section}>
                            <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{section}</p>
                            <p className="font-body-md text-on-surface">{soap[section]}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {/* Differential Diagnoses */}
                {consultation.differentialDiagnoses && consultation.differentialDiagnoses.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
                    <h3 className="font-headline-md text-headline-md text-primary mb-4">Differential Diagnoses</h3>
                    <ol className="space-y-2">
                      {(consultation.differentialDiagnoses as Array<{ diagnosis: string; rank: number }>).map((d, i) => (
                        <li key={i} className="flex items-center gap-3 font-body-md text-on-surface">
                          <span className="text-secondary font-mono text-label-sm w-5 shrink-0">{i + 1}.</span>
                          {d.diagnosis}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Transcript */}
                {consultation.transcript && consultation.transcript.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6">
                    <h3 className="font-headline-md text-headline-md text-primary mb-4">Transcript</h3>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                      {consultation.transcript.map((t, i) => (
                        <div key={i} className={`flex gap-3 font-body-md ${t.speaker === "ai" ? "text-secondary" : "text-on-surface"}`}>
                          <span className="font-label-sm text-on-surface-variant w-14 shrink-0 pt-0.5">
                            {t.speaker === "ai" ? "AI" : "Patient"}
                          </span>
                          <span>{t.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: response composer */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 xl:sticky xl:top-24">
                  <h3 className="font-headline-md text-headline-md text-primary mb-4">Doctor Response</h3>

                  {consultation.aiDraft && (
                    <div className="mb-4">
                      <p className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">AI Draft</p>
                      <div className="bg-secondary-container/20 border border-secondary-container/40 rounded-xl p-4">
                        <p className="font-body-md text-on-secondary-container whitespace-pre-wrap text-sm">
                          {consultation.aiDraft}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={approving}
                      className="w-full bg-secondary text-white py-4 rounded-xl font-manrope font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Approve & Send
                    </button>
                    <Link
                      href={`/doctor/consultation/${id}/amend`}
                      className="w-full bg-primary text-white py-4 rounded-xl font-manrope font-bold hover:bg-primary-container flex items-center justify-center gap-2 transition-colors"
                    >
                      <span className="material-symbols-outlined">edit</span>
                      Amend Response
                    </Link>
                    <Link
                      href={`/doctor/consultation/${id}/reject`}
                      className="w-full bg-error-container text-on-error-container py-4 rounded-xl font-manrope font-bold hover:opacity-90 flex items-center justify-center gap-2 transition-opacity"
                    >
                      <span className="material-symbols-outlined">cancel</span>
                      Reject
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-gutter">
          <div className="bg-surface rounded-xl p-8 max-w-md w-full shadow-modal">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-3">Send this response?</h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              This will send the AI draft response to the patient. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 bg-secondary text-white rounded-xl py-3 font-manrope font-bold hover:opacity-90 disabled:opacity-50"
              >
                {approving ? "Sending…" : "Confirm Send"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border-2 border-outline-variant text-on-surface rounded-xl py-3 font-manrope font-bold hover:bg-surface-container"
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
