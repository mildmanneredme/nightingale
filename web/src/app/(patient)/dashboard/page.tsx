"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsultations, Consultation } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  transcript_ready: "Under Review",
  queued_for_review: "Queued",
  emergency_escalated: "Emergency",
  cannot_assess: "Cannot Assess",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-surface-container text-on-surface-variant",
  active: "bg-secondary-container text-on-secondary-container",
  transcript_ready: "bg-secondary-container text-on-secondary-container",
  queued_for_review: "bg-secondary-container text-on-secondary-container",
  emergency_escalated: "bg-error-container text-on-error-container",
  cannot_assess: "bg-error-container text-on-error-container",
};

export default function DashboardPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConsultations()
      .then(setConsultations)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-stack-lg">
      {/* Welcome + CTA */}
      <div className="bg-primary text-on-primary rounded-xl p-8 mb-8">
        <h1 className="font-display text-headline-lg mb-2">How can we help you today?</h1>
        <p className="text-primary-fixed-dim mb-6">
          Speak with our AI clinical assistant and receive a doctor-reviewed response within hours.
        </p>
        <Link
          href="/consultation/new"
          className="inline-block bg-on-primary text-primary font-semibold rounded py-3 px-6 hover:opacity-90"
        >
          Start a Consultation
        </Link>
      </div>

      {/* Consultation history */}
      <h2 className="font-display text-headline-md text-on-surface mb-4">Your Consultations</h2>

      {loading ? (
        <div className="text-on-surface-variant text-body-md">Loading…</div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p className="text-body-lg">No consultations yet</p>
          <p className="text-body-md mt-2">Start your first consultation above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => (
            <Link
              key={c.id}
              href={`/consultation/${c.id}/result`}
              className="block bg-surface-container-lowest border border-outline-variant rounded-lg p-4 hover:border-secondary transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">
                    {c.presentingComplaint ?? "No complaint recorded"}
                  </p>
                  <p className="text-clinical-data text-on-surface-variant mt-1">
                    {c.consultationType.charAt(0).toUpperCase() + c.consultationType.slice(1)} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString("en-AU")}
                  </p>
                </div>
                <span className={`shrink-0 text-label-sm px-3 py-1 rounded-full ${STATUS_COLORS[c.status] ?? "bg-surface-container text-on-surface-variant"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
