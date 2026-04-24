"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsultations, Consultation, getToken } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  transcript_ready: "Under Review",
  queued_for_review: "Under Review",
  emergency_escalated: "Emergency",
  cannot_assess: "Cannot Assess",
  approved: "Approved",
  amended: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
  unchanged: "Follow-Up Sent",
  followup_concern: "Doctor Follow-Up",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-surface-container text-on-surface-variant",
  active: "bg-secondary-container text-on-secondary-container",
  transcript_ready: "bg-secondary-container text-on-secondary-container",
  queued_for_review: "bg-secondary-container text-on-secondary-container",
  emergency_escalated: "bg-error-container text-on-error-container",
  cannot_assess: "bg-error-container text-on-error-container",
  approved: "bg-tertiary-container text-on-tertiary-container",
  amended: "bg-tertiary-container text-on-tertiary-container",
  rejected: "bg-error-container text-on-error-container",
  resolved: "bg-tertiary-container text-on-tertiary-container",
  unchanged: "bg-surface-container text-on-surface-variant",
  followup_concern: "bg-secondary-container text-on-secondary-container",
};

const PDF_STATUSES = new Set(["approved", "amended"]);

async function downloadPdf(id: string) {
  const token = getToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1/consultations/${id}/pdf`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultation-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

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
        <div className="text-center py-12 bg-surface-container rounded-xl">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant block mb-3">medical_services</span>
          <p className="text-body-lg text-on-surface mb-2">No consultations yet</p>
          <p className="text-body-md text-on-surface-variant mb-6">Start your first consultation to get a doctor-reviewed assessment.</p>
          <Link href="/consultation/new" className="inline-block bg-primary text-on-primary font-semibold rounded py-3 px-6 hover:opacity-90">
            Start a Consultation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => (
            <div
              key={c.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
            >
              <Link
                href={`/consultation/${c.id}/result`}
                className="block hover:opacity-80 transition-opacity"
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
              {PDF_STATUSES.has(c.status) && (
                <div className="mt-3 pt-3 border-t border-outline-variant flex justify-end">
                  <button
                    onClick={() => downloadPdf(c.id)}
                    className="flex items-center gap-1.5 text-secondary text-label-md hover:opacity-70"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
