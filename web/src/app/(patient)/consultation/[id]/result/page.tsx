"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getConsultation, Consultation } from "@/lib/api";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getConsultation(id)
      .then(setConsultation)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;
  }

  if (!consultation) {
    return (
      <div className="py-stack-lg">
        <p className="text-on-surface-variant">Consultation not found.</p>
        <Link href="/dashboard" className="text-secondary underline mt-4 inline-block">Back to dashboard</Link>
      </div>
    );
  }

  const { status } = consultation;

  if (status === "emergency_escalated") {
    return (
      <div className="py-stack-lg max-w-2xl">
        <div className="bg-error-container rounded-xl p-8 mb-6">
          <h1 className="font-display text-headline-lg text-on-error-container mb-3">Emergency Detected</h1>
          <p className="text-on-error-container text-body-md mb-4">
            Based on your symptoms, our AI clinical assistant has flagged a potential emergency. Please call emergency services immediately or go to your nearest emergency department.
          </p>
          <a
            href="tel:000"
            className="inline-block bg-error text-on-error font-semibold rounded-lg py-3 px-6 text-body-md"
          >
            Call 000 Now
          </a>
        </div>
        <Link href="/dashboard" className="text-secondary underline text-body-md">Back to dashboard</Link>
      </div>
    );
  }

  if (status === "cannot_assess") {
    return (
      <div className="py-stack-lg max-w-2xl">
        <div className="bg-surface-container rounded-xl p-8 mb-6">
          <h1 className="font-display text-headline-lg text-on-surface mb-3">Cannot Assess Remotely</h1>
          <p className="text-on-surface-variant text-body-md mb-4">
            We cannot assess your condition remotely based on the information provided. You will receive a full refund. Please see a doctor in person.
          </p>
        </div>
        <Link href="/dashboard" className="text-secondary underline text-body-md">Back to dashboard</Link>
      </div>
    );
  }

  if (status === "approved" && consultation.assessment) {
    return (
      <div className="py-stack-lg max-w-2xl">
        <h1 className="font-display text-headline-lg text-on-surface mb-2">Your Assessment</h1>
        <p className="text-on-surface-variant text-body-md mb-6">Reviewed and approved by a registered GP.</p>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-on-surface text-title-md mb-3">Clinical Assessment</h2>
          <p className="text-on-surface text-body-md whitespace-pre-wrap">{consultation.assessment}</p>
        </div>

        {consultation.prescription && (
          <div className="bg-secondary-container rounded-xl p-6 mb-4">
            <h2 className="font-semibold text-on-secondary-container text-title-md mb-3">Prescription</h2>
            <p className="text-on-secondary-container text-body-md whitespace-pre-wrap">{consultation.prescription}</p>
          </div>
        )}

        <Link href="/dashboard" className="text-secondary underline text-body-md">Back to dashboard</Link>
      </div>
    );
  }

  // Pending / under review states
  return (
    <div className="py-stack-lg max-w-2xl">
      <div className="bg-surface-container rounded-xl p-8 mb-6 text-center">
        <span className="material-symbols-outlined text-5xl text-secondary mb-4 block">pending</span>
        <h1 className="font-display text-headline-lg text-on-surface mb-3">Under Review</h1>
        <p className="text-on-surface-variant text-body-md">
          Your consultation is being reviewed by a registered GP. You&apos;ll receive your assessment within a few hours.
        </p>
      </div>
      <button
        onClick={() => router.refresh()}
        className="w-full border-2 border-secondary text-secondary rounded-lg py-3 font-semibold text-body-md hover:bg-secondary-container mb-4"
      >
        Check Status
      </button>
      <Link href="/dashboard" className="block text-center text-secondary underline text-body-md">Back to dashboard</Link>
    </div>
  );
}
