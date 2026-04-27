"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAdminDoctorApplication, approveApplication, rejectApplication } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const AHPRA_REGISTER_URL = "https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-40 shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-900 font-medium">{value ?? "—"}</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DoctorApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ahpraVerified, setAhpraVerified] = useState(false);

  const { data: app, isLoading, error } = useQuery({
    queryKey: ["admin-doctor-application", id],
    queryFn: () => getAdminDoctorApplication(id),
    enabled: !!token && !!id,
  });

  async function handleApprove() {
    if (!ahpraVerified) {
      setActionError("You must confirm AHPRA verification before approving.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await approveApplication(id);
      router.replace("/admin/doctors/applications");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 10) {
      setActionError("Reason must be at least 10 characters.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectApplication(id, rejectReason.trim());
      router.replace("/admin/doctors/applications");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <span className="material-symbols-outlined text-4xl block mb-2 animate-spin">progress_activity</span>
        Loading application…
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          Application not found or failed to load.{" "}
          <Link href="/admin/doctors/applications" className="underline">Back to list</Link>
        </div>
      </div>
    );
  }

  const isPending  = app.status === "pending";
  const isApproved = app.status === "approved";
  const isRejected = app.status === "rejected";

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/doctors/applications" className="text-gray-400 hover:text-gray-700">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{app.full_name}</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
          isPending  ? "bg-amber-100 text-amber-800" :
          isApproved ? "bg-green-100 text-green-800" :
                       "bg-red-100 text-red-800"
        }`}>
          {app.status}
        </span>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <Row label="Email"       value={<a href={`mailto:${app.email}`} className="text-blue-600 hover:underline">{app.email}</a>} />
        <Row label="AHPRA"       value={
          <span className="flex items-center gap-2 font-mono">
            {app.ahpra_number}
            <a
              href={`${AHPRA_REGISTER_URL}?type=Medical`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs font-sans"
            >
              Verify on AHPRA register ↗
            </a>
          </span>
        } />
        <Row label="Specialty"   value={app.specialty} />
        <Row label="State"       value={app.primary_state} />
        <Row label="Mobile"      value={app.mobile} />
        <Row label="Hours/Week"  value={app.hours_per_week} />
        <Row label="Applied At"  value={formatDate(app.applied_at)} />
        {isApproved && <Row label="Approved At" value={formatDate(app.approved_at)} />}
        {isRejected && (
          <>
            <Row label="Rejected At" value={formatDate(app.rejected_at)} />
            <Row label="Reason"      value={<span className="text-red-700">{app.rejection_reason}</span>} />
          </>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gray-900">Review Decision</h2>

          {actionError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{actionError}</div>
          )}

          {/* AHPRA verification confirmation */}
          <label className="flex items-start gap-3 cursor-pointer p-3 bg-amber-50 rounded-lg border border-amber-200">
            <input
              type="checkbox"
              checked={ahpraVerified}
              onChange={(e) => setAhpraVerified(e.target.checked)}
              className="mt-0.5 accent-green-600"
            />
            <span className="text-sm text-gray-700">
              I have verified <strong>{app.full_name}</strong> ({app.ahpra_number}) on the AHPRA register and their registration is current and unconditional.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={actionLoading || !ahpraVerified}
              className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Processing…" : "Approve Application"}
            </button>
            <button
              onClick={() => { setShowRejectForm(true); setActionError(null); }}
              disabled={actionLoading}
              className="flex-1 py-3 bg-white text-red-600 font-bold rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>

          {showRejectForm && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="text-sm font-semibold text-gray-700 block">Rejection reason (required, shown to applicant)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. AHPRA registration not found / registration is conditional / specialty outside current scope."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{rejectReason.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason(""); setActionError(null); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading || rejectReason.trim().length < 10}
                    className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing…" : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
