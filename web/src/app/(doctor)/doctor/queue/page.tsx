"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getDoctorQueue, DoctorQueueItem } from "@/lib/api";

const FLAG_STYLES: Record<string, string> = {
  LOW_CONFIDENCE: "bg-orange-100 text-orange-800",
  CANNOT_ASSESS: "bg-error-container text-on-error-container",
  INCOMPLETE_INTERVIEW: "bg-orange-100 text-orange-800",
  POOR_PHOTO: "bg-orange-100 text-orange-800",
  PEDIATRIC: "bg-blue-100 text-blue-800",
  CHRONIC_CARE: "bg-teal-100 text-teal-800",
  ROUTINE: "bg-surface-container text-on-surface-variant",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="py-stack-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-headline-lg text-on-surface">
          Pending Consultations {!loading && `(${queue.length})`}
        </h1>
        <button onClick={load} className="text-secondary text-body-md hover:opacity-70">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-on-surface-variant">Loading…</div>
      ) : queue.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <p className="text-body-lg">Queue is empty</p>
          <p className="text-body-md mt-2">No consultations awaiting review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <Link
              key={item.id}
              href={`/doctor/consultation/${item.id}`}
              className="block bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:border-secondary transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {(item.priorityFlags ?? []).map((flag) => (
                      <span
                        key={flag}
                        className={`text-label-sm px-2 py-0.5 rounded-full ${FLAG_STYLES[flag] ?? "bg-surface-container text-on-surface-variant"}`}
                      >
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  <p className="text-body-md text-on-surface font-medium truncate">
                    {item.presentingComplaint ?? "No complaint recorded"}
                  </p>
                  <p className="text-clinical-data text-on-surface-variant mt-1">
                    {item.consultationType.charAt(0).toUpperCase() + item.consultationType.slice(1)} ·{" "}
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-secondary text-label-sm font-semibold">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
