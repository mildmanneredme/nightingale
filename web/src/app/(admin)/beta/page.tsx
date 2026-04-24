"use client";

import { useEffect, useState } from "react";

interface AdminStats {
  patients: { total: number };
  consultations: {
    total: number;
    pending: number;
    approved: number;
    amended: number;
    rejected: number;
    emergencyEscalated: number;
    cannotAssess: number;
    resolved: number;
    followupConcern: number;
  };
  rates: {
    approvalPct: number | null;
    amendmentPct: number | null;
    rejectionPct: number | null;
    avgReviewMinutes: number | null;
  };
  followUp: {
    sent: number;
    responded: number;
    better: number;
    same: number;
    worse: number;
  };
}

function StatCard({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function BetaDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Failed to load stats: {error}</p>
      </div>
    );
  }

  const { consultations: c, rates, followUp } = stats;
  const responseRate =
    followUp.sent > 0 ? Math.round((followUp.responded / followUp.sent) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Beta Launch Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Live stats for the Nightingale beta cohort</p>
        </div>

        {/* Top-level counts */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Beta Patients" value={stats.patients.total} sub="Target: 100" />
            <StatCard label="Total Consultations" value={c.total} sub="Target: 200" />
            <StatCard
              label="Pending Review"
              value={c.pending}
              color={c.pending > 10 ? "text-amber-600" : "text-gray-900"}
            />
            <StatCard
              label="Avg Review Time"
              value={rates.avgReviewMinutes !== null ? `${rates.avgReviewMinutes} min` : "—"}
              sub="Target: < 5 min"
              color={
                rates.avgReviewMinutes !== null && rates.avgReviewMinutes > 5
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </div>
        </section>

        {/* Doctor outcome rates */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Doctor Review Outcomes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Approved (no edit)"
              value={rates.approvalPct !== null ? `${rates.approvalPct}%` : "—"}
              sub={`${c.approved} consultations`}
              color="text-emerald-600"
            />
            <StatCard
              label="Amended"
              value={rates.amendmentPct !== null ? `${rates.amendmentPct}%` : "—"}
              sub={`${c.amended} consultations`}
              color="text-blue-600"
            />
            <StatCard
              label="Rejected"
              value={rates.rejectionPct !== null ? `${rates.rejectionPct}%` : "—"}
              sub={`${c.rejected} consultations`}
              color={
                rates.rejectionPct !== null && rates.rejectionPct > 15
                  ? "text-red-600"
                  : "text-gray-900"
              }
            />
            <StatCard
              label="Emergency Escalated"
              value={c.emergencyEscalated}
              color={c.emergencyEscalated > 0 ? "text-red-600" : "text-gray-900"}
            />
          </div>
        </section>

        {/* Follow-up outcomes */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Follow-Up Outcomes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Emails Sent" value={followUp.sent} />
            <StatCard
              label="Response Rate"
              value={responseRate !== null ? `${responseRate}%` : "—"}
              sub={`${followUp.responded} responded`}
            />
            <StatCard label="Feeling Better" value={followUp.better} color="text-emerald-600" />
            <StatCard label="About the Same" value={followUp.same} color="text-blue-600" />
            <StatCard
              label="Feeling Worse"
              value={followUp.worse}
              color={followUp.worse > 0 ? "text-amber-600" : "text-gray-900"}
              sub={followUp.worse > 0 ? "Re-opened for review" : undefined}
            />
          </div>
        </section>

        {/* Beta launch gate checklist */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Beta Launch Gate
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Technical</p>
                <GateItem done label="All PRDs shipped (PRD-003 through PRD-018)" />
                <GateItem done={false} label="E2E test — all 10 scenarios passing" />
                <GateItem done={false} label="Penetration test complete; critical/high findings remediated" />
                <GateItem done={false} label="Monitoring & alerting active (CloudWatch)" />
                <GateItem done={false} label="Backup restoration tested in staging" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Compliance & Operational</p>
                <GateItem done={false} label="Privacy Policy & Collection Notice published" />
                <GateItem done={false} label="All DPAs signed (SendGrid, Stripe, Twilio, Vapi, AWS)" />
                <GateItem done={false} label="TGA pre-submission advice received" />
                <GateItem done={false} label="AHPRA advertising sign-off" />
                <GateItem done={false} label="Medical Director indemnity confirmed" />
                <GateItem done={false} label="Clinical governance framework signed" />
                <GateItem done={false} label="Incident response runbook complete" />
                <GateItem done={false} label="Beta cohort (100 patients) identified & invited" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function GateItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className={`mt-0.5 text-base ${done ? "text-emerald-500" : "text-gray-300"}`}>
        {done ? "✓" : "○"}
      </span>
      <span className={`text-sm ${done ? "text-gray-700" : "text-gray-500"}`}>{label}</span>
    </div>
  );
}
