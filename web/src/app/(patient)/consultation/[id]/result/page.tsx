"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getConsultation, getToken, Consultation } from "@/lib/api";
import { ErrorState } from "@/components/ErrorState";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";

async function downloadPdf(id: string) {
  const token = getToken();
  const res = await fetch(`/api/v1/consultations/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultation-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getConsultation(id).then(setConsultation).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <TopAppBar />
        <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-3xl mx-auto flex items-center justify-center py-24">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant animate-spin">progress_activity</span>
        </main>
        <BottomNavBar active="history" />
      </>
    );
  }

  if (!consultation) {
    return (
      <>
        <TopAppBar />
        <main className="pt-24 pb-20 px-4 md:px-patient-margin max-w-3xl mx-auto">
          <ErrorState title="Consultation Not Found" message="We couldn't find this consultation." />
        </main>
        <BottomNavBar active="history" />
      </>
    );
  }

  const { status } = consultation;

  const shell = (children: React.ReactNode) => (
    <>
      <TopAppBar activeNav="records" />
      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-3xl mx-auto">
        {children}
        <div className="mt-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-secondary font-bold hover:underline">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to dashboard
          </Link>
        </div>
      </main>
      <BottomNavBar active="history" />
    </>
  );

  // Emergency
  if (status === "emergency_escalated") {
    return shell(
      <div className="bg-error-container rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <span className="material-symbols-outlined text-5xl text-on-error-container" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
          <div>
            <h1 className="font-manrope text-headline-lg text-on-error-container">Emergency Detected</h1>
            <p className="font-clinical-data text-on-error-container/70">Immediate action required</p>
          </div>
        </div>
        <p className="font-body-md text-on-error-container mb-6">
          Our AI triage has flagged a potential emergency. Please call emergency services immediately or go to your nearest emergency department.
        </p>
        <a href="tel:000" className="inline-flex items-center gap-2 bg-error text-white font-manrope font-bold rounded-xl py-3 px-6">
          <span className="material-symbols-outlined">call</span>
          Call 000 Now
        </a>
      </div>
    );
  }

  // Cannot assess
  if (status === "cannot_assess") {
    return shell(
      <div className="bg-surface-container rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant block mb-4">sentiment_dissatisfied</span>
        <h1 className="font-manrope text-headline-lg text-on-surface mb-3">Cannot Assess Remotely</h1>
        <p className="font-body-md text-on-surface-variant mb-4">
          We cannot assess your condition remotely. You will receive a full refund. Please see a doctor in person.
        </p>
        <p className="font-body-md text-on-surface-variant">
          For health advice, call <strong>HealthDirect 1800 022 222</strong> (free, 24/7).
        </p>
      </div>
    );
  }

  // Approved / Amended
  if ((status === "approved" || status === "amended") && (consultation.assessment || consultation.doctorDraft)) {
    const content = status === "amended" ? consultation.doctorDraft : consultation.assessment;
    return shell(
      <>
        {/* Hero banner */}
        <div className="bg-secondary rounded-2xl p-8 mb-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-3xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <h1 className="font-manrope text-headline-lg text-white mb-1">Consultation Approved</h1>
            <p className="font-body-md text-white/80">
              {status === "amended" ? "Reviewed and amended by a registered GP." : "Reviewed and approved by a registered GP."}
            </p>
          </div>
        </div>

        {/* Assessment */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">description</span>
            <h2 className="font-manrope text-headline-md text-primary">Clinical Assessment</h2>
          </div>
          <p className="font-body-md text-on-surface whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>

        {consultation.prescription && (
          <div className="bg-secondary-container/20 rounded-2xl border border-secondary-container/40 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary">medication</span>
              <h2 className="font-manrope text-headline-md text-on-secondary-container">Prescription</h2>
            </div>
            <p className="font-body-md text-on-secondary-container whitespace-pre-wrap">{consultation.prescription}</p>
          </div>
        )}

        {/* PDF Download */}
        <button
          onClick={() => id && downloadPdf(id)}
          className="w-full flex items-center justify-center gap-3 bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined">download</span>
          Download PDF Report
        </button>
      </>
    );
  }

  // Rejected
  if (status === "rejected") {
    return shell(
      <>
        <div className="bg-surface-container rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-error-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
            </div>
            <div>
              <h1 className="font-manrope text-headline-lg text-on-surface">Unable to Assess Remotely</h1>
              <p className="font-clinical-data text-on-surface-variant">Doctor review complete</p>
            </div>
          </div>
          <p className="font-body-md text-on-surface-variant mb-4">
            The doctor reviewing your consultation was unable to complete a remote assessment for this case.
          </p>
          {consultation.rejectionMessage && (
            <div className="bg-white rounded-xl p-4 mb-4 border border-outline-variant">
              <p className="font-body-md text-on-surface">{consultation.rejectionMessage}</p>
            </div>
          )}
          <p className="font-body-md text-on-surface-variant mb-4">
            We recommend booking an appointment with a GP in person.
            For advice, call <strong>HealthDirect 1800 022 222</strong> (free, 24/7).
          </p>
          <div className="bg-secondary-container/20 rounded-xl p-4 text-on-secondary-container font-body-md">
            <span className="material-symbols-outlined text-secondary align-middle mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <strong>A full refund has been initiated.</strong> Funds return within 3–5 business days.
          </div>
        </div>
        <button className="w-full flex items-center justify-center gap-2 bg-primary text-white font-manrope font-bold py-4 rounded-xl hover:bg-primary-container">
          <span className="material-symbols-outlined">location_on</span>
          Find a clinic near you
        </button>
      </>
    );
  }

  // Follow-up states
  if (status === "followup_concern") {
    return shell(
      <div className="bg-secondary-container/20 rounded-2xl border border-secondary-container/30 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-secondary block mb-4">notifications_active</span>
        <h1 className="font-manrope text-headline-lg text-primary mb-3">Doctor Follow-Up in Progress</h1>
        <p className="font-body-md text-on-surface-variant">
          A doctor has been notified and will review your case again shortly. You will receive an updated assessment by email.
        </p>
      </div>
    );
  }

  if (status === "resolved" || status === "unchanged") {
    return shell(
      <div className="bg-surface-container rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-secondary block mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
          {status === "resolved" ? "sentiment_satisfied" : "info"}
        </span>
        <h1 className="font-manrope text-headline-lg text-on-surface mb-3">
          {status === "resolved" ? "Feeling Better" : "Condition Unchanged"}
        </h1>
        <p className="font-body-md text-on-surface-variant">
          {status === "resolved"
            ? "Glad to hear you're feeling better. Your consultation is now closed."
            : "Your follow-up has been recorded. If your condition worsens, please seek in-person care."}
        </p>
      </div>
    );
  }

  // Pending / under review
  return shell(
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center mb-4">
        <span className="material-symbols-outlined text-5xl text-secondary block mb-4 animate-pulse">hourglass_top</span>
        <h1 className="font-manrope text-headline-lg text-primary mb-3">Under Review</h1>
        <p className="font-body-md text-on-surface-variant mb-2">
          Your consultation is being reviewed by a registered GP.
        </p>
        <p className="font-clinical-data text-on-surface-variant">Typical review time: <span className="text-secondary font-bold">1–4 hours</span></p>
      </div>
      <button
        onClick={() => router.refresh()}
        className="w-full border-2 border-secondary text-secondary font-manrope font-bold rounded-xl py-3 hover:bg-secondary-container/20 transition-colors"
      >
        Check Status
      </button>
    </>
  );
}
