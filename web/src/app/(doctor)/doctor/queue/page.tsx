"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoctorQueue, DoctorQueueItem } from "@/lib/api";
import DoctorSideNav from "@/components/DoctorSideNav";

const FLAG_STYLES: Record<string, { bg: string; text: string }> = {
  LOW_CONFIDENCE:      { bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  POOR_PHOTO:          { bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  INCOMPLETE_INTERVIEW:{ bg: "bg-tertiary-container",   text: "text-tertiary-fixed" },
  CANNOT_ASSESS:       { bg: "bg-error-container",      text: "text-on-error-container" },
  PEDIATRIC:           { bg: "bg-error-container",      text: "text-on-error-container" },
  CHRONIC_CARE:        { bg: "bg-secondary-container",  text: "text-on-secondary-container" },
  ROUTINE:             { bg: "bg-slate-100",             text: "text-slate-600" },
};

const FLAGGED_STATUSES = new Set(["LOW_CONFIDENCE", "POOR_PHOTO", "INCOMPLETE_INTERVIEW", "CANNOT_ASSESS", "PEDIATRIC"]);

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

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");

  async function load() {
    try {
      const items = await getDoctorQueue();
      setQueue(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, []);

  const filtered = queue.filter((item) => {
    if (filter === "VOICE") return item.consultationType === "voice";
    if (filter === "TEXT") return item.consultationType === "text";
    return true;
  });

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
                Pending Consultations{!loading && ` (${filtered.length})`}
              </h2>
              <p className="font-clinical-data text-on-surface-variant mt-1">
                Review and manage incoming patient requests in priority order.
              </p>
            </div>
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
                onClick={load}
                className="flex items-center gap-2 bg-white border border-outline-variant px-3 py-2 rounded-lg text-xs font-bold font-manrope text-primary hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                REFRESH
              </button>
            </div>
          </div>

          {/* Queue */}
          {loading ? (
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

                    {/* Header row */}
                    <div className="flex items-start justify-between pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <span className="material-symbols-outlined text-3xl">person</span>
                        </div>
                        <div>
                          <h3 className="font-headline-md text-headline-md text-primary tracking-tight">
                            Patient
                          </h3>
                          <p className="font-clinical-data text-xs text-on-surface-variant">
                            ID: #{item.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {/* Type badge */}
                      <span className={`px-2 py-1 rounded font-bold text-[10px] uppercase flex items-center gap-1 ${
                        isVoice ? "bg-blue-50 text-blue-900" : "bg-emerald-50 text-emerald-800"
                      }`}>
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {isVoice ? "mic" : "chat_bubble"}
                        </span>
                        {isVoice ? "Voice" : "Text"}
                      </span>
                    </div>

                    {/* Complaint + flags */}
                    <div className="pl-2 space-y-2">
                      <p className="font-clinical-data text-sm text-primary line-clamp-2">
                        &ldquo;{item.presentingComplaint ?? "No complaint recorded"}&rdquo;
                      </p>
                      {(item.priorityFlags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(item.priorityFlags ?? []).map((flag) => {
                            const style = FLAG_STYLES[flag] ?? { bg: "bg-slate-100", text: "text-slate-600" };
                            return (
                              <span
                                key={flag}
                                className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${style.bg} ${style.text}`}
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="pl-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                          <span className="text-xs font-semibold">{timeAgo(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="material-symbols-outlined text-[18px]">photo_library</span>
                          <span className="text-xs font-semibold">—</span>
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
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
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
