"use client";
import { useState } from "react";
import Link from "next/link";
import { getDoctorQueue, getDoctorMe, DoctorQueueItem, DoctorStatus } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import DoctorSideNav from "@/components/DoctorSideNav";

const FLAG_STYLES: Record<string, { bg: string; text: string }> = {
  LOW_CONFIDENCE:       { bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  POOR_PHOTO:           { bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  INCOMPLETE_INTERVIEW: { bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  CANNOT_ASSESS:        { bg: "bg-error-container",      text: "text-on-error-container" },
  PEDIATRIC:            { bg: "bg-error-container",      text: "text-on-error-container" },
  CHRONIC_CARE:         { bg: "bg-secondary-container",  text: "text-on-secondary-container" },
  ROUTINE:              { bg: "bg-slate-100",             text: "text-slate-600" },
};

const FLAGGED_STATUSES = new Set(["LOW_CONFIDENCE", "POOR_PHOTO", "INCOMPLETE_INTERVIEW", "CANNOT_ASSESS", "PEDIATRIC"]);

const PAGE_LIMIT = 20;

type FilterType = "ALL" | "VOICE" | "TEXT";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isFlagged(item: DoctorQueueItem): boolean {
  return (item.priorityFlags ?? []).some((f) => FLAGGED_STATUSES.has(f));
}

// ---------------------------------------------------------------------------
// Pending state — shows frosted queue skeleton + status banner
// ---------------------------------------------------------------------------
function PendingOverlay({ waiting, reviewedToday }: { waiting: number; reviewedToday: number }) {
  return (
    <div className="relative">
      {/* Status banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 mt-0.5">hourglass_top</span>
        <div>
          <p className="font-bold text-amber-900">Application under review</p>
          <p className="text-sm text-amber-700 mt-0.5">
            We&rsquo;re verifying your AHPRA registration. This usually takes 1–2 business days.
            You&rsquo;ll receive an email once your account is active.
          </p>
        </div>
      </div>

      {/* Live platform stats */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-3xl font-black text-primary">{waiting}</p>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold uppercase tracking-wider">Awaiting Review</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-3xl font-black text-secondary">{reviewedToday}</p>
          <p className="text-xs text-on-surface-variant mt-1 font-semibold uppercase tracking-wider">Reviewed Today</p>
        </div>
      </div>

      {/* Frosted skeleton cards */}
      <div className="relative">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 select-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 opacity-40">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-slate-200 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-sm bg-white/30 rounded-xl flex items-center justify-center">
          <div className="text-center px-6">
            <span className="material-symbols-outlined text-5xl text-slate-400 block mb-3">lock</span>
            <p className="text-slate-600 font-semibold">Queue unlocks once your AHPRA registration is verified.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rejected state
// ---------------------------------------------------------------------------
function RejectedBanner() {
  return (
    <div className="p-6 rounded-xl bg-error-container border border-error text-on-error-container flex flex-col gap-2">
      <div className="flex items-center gap-2 font-bold">
        <span className="material-symbols-outlined">cancel</span>
        Application not approved
      </div>
      <p className="text-sm">
        Unfortunately your application was not approved. Please check your email for more information
        or contact{" "}
        <a href="mailto:applications@nightingale.health" className="underline font-bold">
          applications@nightingale.health
        </a>
        .
      </p>
    </div>
  );
}

export default function DoctorQueuePage() {
  const { token } = useAuth();
  const [extraQueue, setExtraQueue] = useState<DoctorQueueItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const { data: doctorStatus } = useQuery<DoctorStatus>({
    queryKey: ["doctor-me"],
    queryFn: getDoctorMe,
    enabled: !!token,
    staleTime: 30_000,
  });

  const { data: queueData, isLoading: loading, refetch } = useQuery({
    queryKey: ["doctor-queue"],
    queryFn: () => getDoctorQueue(PAGE_LIMIT, 0),
    staleTime: 0,
    refetchInterval: 30_000,
    enabled: !!token,
  });

  // Pending/rejected doctors receive mode:"counts" from the API
  const isCountsMode = queueData?.mode === "counts";
  const waiting      = isCountsMode ? queueData.waiting      : 0;
  const reviewedToday = isCountsMode ? queueData.reviewedToday : 0;

  const initialQueue  = (!isCountsMode && queueData?.mode === "full") ? queueData.data : [];
  const initialHasMore = (!isCountsMode && queueData?.mode === "full") ? queueData.pagination.hasMore : false;
  const queue = [...initialQueue, ...extraQueue];
  const showHasMore = hasMore ?? initialHasMore;
  const effectiveOffset = offset === 0 ? initialQueue.length : offset;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await getDoctorQueue(PAGE_LIMIT, effectiveOffset);
      if (res.mode === "full") {
        setExtraQueue((prev) => [...prev, ...res.data]);
        setHasMore(res.pagination.hasMore);
        setOffset(effectiveOffset + res.data.length);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = queue.filter((item) => {
    if (filter === "VOICE") return item.consultationType === "voice";
    if (filter === "TEXT") return item.consultationType === "text";
    return true;
  });

  const isRejected = doctorStatus?.status === "rejected";

  return (
    <div className="bg-background min-h-screen flex">
      <DoctorSideNav active="queue" />

      <main className="flex-1 min-w-0">
        {/* TopAppBar */}
        <header className="fixed top-0 right-0 left-0 md:left-64 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 h-16 flex justify-between items-center">
          <span className="md:hidden font-black text-primary text-lg font-manrope">Nightingale</span>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <button className="text-slate-500 hover:text-primary transition-colors p-2">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-slate-500 hover:text-primary transition-colors p-2">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
          </div>
        </header>

        <div className="mt-16 p-4 md:p-doctor-margin max-w-7xl mx-auto">
          {/* Header + Filters */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
                {isCountsMode ? "Application Pending" : `Pending Consultations${!loading ? ` (${filtered.length})` : ""}`}
              </h2>
              <p className="font-clinical-data text-on-surface-variant mt-1">
                {isCountsMode
                  ? "Your application is being reviewed. The queue will unlock once verified."
                  : "Review and manage incoming patient requests in priority order."}
              </p>
            </div>
            {!isCountsMode && !isRejected && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-surface-container rounded-lg p-1">
                  {(["ALL", "VOICE", "TEXT"] as FilterType[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 text-xs font-bold font-manrope rounded transition-colors ${
                        filter === f
                          ? "bg-white shadow-sm text-primary"
                          : "text-on-surface-variant hover:text-primary"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-2 bg-white border border-outline-variant px-3 py-2 rounded-lg text-xs font-bold font-manrope text-primary hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  REFRESH
                </button>
              </div>
            )}
          </div>

          {/* Rejected banner */}
          {isRejected && <RejectedBanner />}

          {/* Pending frosted view */}
          {!isRejected && isCountsMode && (
            <PendingOverlay waiting={waiting} reviewedToday={reviewedToday} />
          )}

          {/* Approved queue */}
          {!isRejected && !isCountsMode && (
            loading ? (
              <div className="text-center py-16 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2 animate-spin">progress_activity</span>
                Loading queue…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl block mb-3">inbox</span>
                <p className="font-body-lg">Queue is empty</p>
                <p className="font-body-md mt-2">No consultations awaiting review.</p>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filtered.map((item) => {
                  const flagged = isFlagged(item);
                  const isVoice = item.consultationType === "voice";

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden ${
                        flagged ? "border-2 border-tertiary-fixed-dim" : "border border-slate-200"
                      }`}
                    >
                      {flagged && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-tertiary-fixed-dim" />
                      )}

                      <div className="flex items-start justify-between pl-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-3xl">person</span>
                          </div>
                          <div>
                            <h3 className="font-headline-md text-headline-md text-primary tracking-tight">Patient</h3>
                            <p className="font-clinical-data text-xs text-on-surface-variant">
                              ID: #{item.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded font-bold text-[10px] uppercase flex items-center gap-1 ${
                          isVoice ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-800"
                        }`}>
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {isVoice ? "mic" : "chat_bubble"}
                          </span>
                          {isVoice ? "Voice" : "Text"}
                        </span>
                      </div>

                      <div className="pl-2 space-y-2">
                        <p className="font-clinical-data text-sm text-primary line-clamp-2">
                          &ldquo;{item.presentingComplaint ?? "No complaint recorded"}&rdquo;
                        </p>
                        {(item.priorityFlags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(item.priorityFlags ?? []).map((flag) => {
                              const style = FLAG_STYLES[flag] ?? { bg: "bg-slate-100", text: "text-slate-600" };
                              return (
                                <span key={flag} className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${style.bg} ${style.text}`}>
                                  {flag.replace(/_/g, " ")}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {(item.clinicalContextWarnings ?? []).length > 0 && (
                          <div
                            className="flex items-center gap-2 text-on-tertiary-container bg-tertiary-container/50 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase w-fit"
                            title={(item.clinicalContextWarnings ?? []).join("\n")}
                          >
                            <span className="material-symbols-outlined text-[14px]">help</span>
                            Baseline incomplete ({(item.clinicalContextWarnings ?? []).length})
                          </div>
                        )}
                      </div>

                      <div className="pl-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-slate-500">
                            <span className="material-symbols-outlined text-[18px]">schedule</span>
                            <span className="text-xs font-semibold">{timeAgo(item.createdAt)}</span>
                          </div>
                        </div>
                        <Link
                          href={`/doctor/consultation/${item.id}`}
                          className="bg-primary text-white px-6 py-2 rounded-lg font-manrope text-xs font-bold uppercase tracking-widest hover:bg-primary-container transition-colors shadow-sm"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {showHasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-white border border-outline-variant px-6 py-2.5 rounded-lg text-sm font-bold font-manrope text-primary hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    )}
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
              </>
            )
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden flex justify-around items-center px-4 pt-3 pb-6 bg-white border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-2xl">
        <Link href="/doctor/queue" className="flex flex-col items-center justify-center text-primary bg-blue-50 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <span className="font-manrope text-[10px] font-bold uppercase tracking-widest mt-1">Queue</span>
        </Link>
        <Link href="/doctor/schedule" className="flex flex-col items-center justify-center text-slate-400">
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="font-manrope text-[10px] font-bold uppercase tracking-widest mt-1">Schedule</span>
        </Link>
      </nav>
    </div>
  );
}
