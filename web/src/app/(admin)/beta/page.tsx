"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminStats, AdminStats } from "@/lib/api";

function StatCard({
  label,
  value,
  sub,
  color = "text-gray-900",
  loading = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <div className="h-9 w-20 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
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

export default function BetaDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) fetchStats();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">Failed to load stats: {error}</p>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="px-4 py-2 bg-gray-900 text-white rounded text-sm hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  const c = stats?.consultations;
  const rates = stats?.rates;
  const followUp = stats?.followUp;
  const responseRate =
    followUp && followUp.sent > 0
      ? Math.round((followUp.responded / followUp.sent) * 100)
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Beta Launch Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Live stats for the Nightingale beta cohort</p>
          </div>
          <div className="text-right">
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                Last updated{" "}
                {lastUpdated.toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </div>

        {/* Overview */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Beta Patients" value={stats?.patients.total ?? 0} sub="Target: 100" loading={loading} />
            <StatCard label="Total Consultations" value={c?.total ?? 0} sub="Target: 200" loading={loading} />
            <StatCard
              label="Pending Review"
              value={c?.pending ?? 0}
              color={(c?.pending ?? 0) > 10 ? "text-amber-600" : "text-gray-900"}
              loading={loading}
            />
            <StatCard
              label="Avg Review Time"
              value={rates?.avgReviewMinutes != null ? `${rates.avgReviewMinutes} min` : "—"}
              sub="Target: < 5 min"
              color={
                rates?.avgReviewMinutes != null && rates.avgReviewMinutes > 5
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
              loading={loading}
            />
          </div>
        </section>

        {/* Doctor outcome rates */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Doctor Review Outcomes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Approved (no edit)"
              value={rates?.approvalPct != null ? `${rates.approvalPct}%` : "—"}
              sub={`${c?.approved ?? 0} consultations`}
              color="text-emerald-600"
              loading={loading}
            />
            <StatCard
              label="Amended"
              value={rates?.amendmentPct != null ? `${rates.amendmentPct}%` : "—"}
              sub={`${c?.amended ?? 0} consultations`}
              color="text-blue-600"
              loading={loading}
            />
            <StatCard
              label="Rejected"
              value={rates?.rejectionPct != null ? `${rates.rejectionPct}%` : "—"}
              sub={`${c?.rejected ?? 0} consultations`}
              color={
                rates?.rejectionPct != null && rates.rejectionPct > 15
                  ? "text-red-600"
                  : "text-gray-900"
              }
              loading={loading}
            />
            <StatCard
              label="Emergency Escalated"
              value={c?.emergencyEscalated ?? 0}
              color={(c?.emergencyEscalated ?? 0) > 0 ? "text-red-600" : "text-gray-900"}
              loading={loading}
            />
          </div>
        </section>

        {/* Follow-up outcomes */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Follow-Up Outcomes</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Emails Sent" value={followUp?.sent ?? 0} loading={loading} />
            <StatCard
              label="Response Rate"
              value={responseRate != null ? `${responseRate}%` : "—"}
              sub={`${followUp?.responded ?? 0} responded`}
              loading={loading}
            />
            <StatCard label="Feeling Better" value={followUp?.better ?? 0} color="text-emerald-600" loading={loading} />
            <StatCard label="About the Same" value={followUp?.same ?? 0} color="text-blue-600" loading={loading} />
            <StatCard
              label="Feeling Worse"
              value={followUp?.worse ?? 0}
              color={(followUp?.worse ?? 0) > 0 ? "text-amber-600" : "text-gray-900"}
              sub={(followUp?.worse ?? 0) > 0 ? "Re-opened for review" : undefined}
              loading={loading}
            />
          </div>
        </section>

        {/* Beta launch gate checklist */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Beta Launch Gate</h2>
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
