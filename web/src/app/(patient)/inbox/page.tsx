"use client";
import { useState } from "react";
import Link from "next/link";
import { getInbox, markNotificationRead, InboxItem, getToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_LIMIT = 20;

const TYPE_LABELS: Record<string, string> = {
  response_ready: "Response Ready",
  rejected: "Consultation Rejected",
  renewal_approved: "Renewal Approved",
  renewal_declined: "Renewal Declined",
  followup: "Follow-Up Request",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-tertiary-container text-on-tertiary-container",
  amended: "bg-tertiary-container text-on-tertiary-container",
  rejected: "bg-error-container text-on-error-container",
};

const PDF_STATUSES = new Set(["approved", "amended"]);
const RESULT_TYPES = new Set(["response_ready", "rejected"]);

async function downloadPdf(consultationId: string) {
  const token = getToken();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1/consultations/${consultationId}/pdf`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultation-${consultationId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InboxPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [extraItems, setExtraItems] = useState<InboxItem[]>([]);
  const [extraUnread, setExtraUnread] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<InboxItem | null>(null);

  // F-053: useQuery for initial fetch; F-056: use isLoading from query
  const { data: initialData, isLoading: loading } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => getInbox(PAGE_LIMIT, 0),
    enabled: !!token,
  });

  const initialItems = initialData?.items ?? [];
  const initialHasMore = initialData?.pagination.hasMore ?? false;
  const initialUnread = initialData?.unreadCount ?? 0;
  const items = [...initialItems, ...extraItems];
  const unreadCount = Math.max(0, initialUnread + extraUnread);
  const showHasMore = hasMore ?? initialHasMore;
  const effectiveOffset = offset === 0 ? initialItems.length : offset;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await getInbox(PAGE_LIMIT, effectiveOffset);
      setExtraItems((prev) => [...prev, ...data.items]);
      setHasMore(data.pagination.hasMore);
      setOffset(effectiveOffset + data.items.length);
    } finally {
      setLoadingMore(false);
    }
  }

  async function openItem(item: InboxItem) {
    setSelected(item);
    if (item.isUnread) {
      await markNotificationRead(item.notificationId).catch(() => null);
      // Optimistically update the read state and invalidate to sync
      setExtraUnread((c) => c - 1);
      queryClient.setQueryData(["inbox"], (old: typeof initialData) => {
        if (!old) return old;
        return {
          ...old,
          unreadCount: Math.max(0, old.unreadCount - 1),
          items: old.items.map((i) =>
            i.notificationId === item.notificationId
              ? { ...i, isUnread: false, readAt: new Date().toISOString() }
              : i
          ),
        };
      });
      setExtraItems((prev) =>
        prev.map((i) =>
          i.notificationId === item.notificationId
            ? { ...i, isUnread: false, readAt: new Date().toISOString() }
            : i
        )
      );
    }
  }

  if (loading) {
    return <div className="py-stack-lg text-on-surface-variant text-body-md">Loading…</div>;
  }

  if (selected) {
    const canViewResult = RESULT_TYPES.has(selected.notificationType);
    const canDownloadPdf = PDF_STATUSES.has(selected.consultation.status);

    return (
      <div className="py-stack-lg max-w-2xl">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-primary text-body-md mb-6"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          Back to Inbox
        </button>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-display text-headline-sm text-on-surface">
                {TYPE_LABELS[selected.notificationType] ?? selected.notificationType}
              </h2>
              {selected.consultation.doctorName && (
                <p className="text-body-md text-on-surface-variant mt-1">
                  From {selected.consultation.doctorName}
                </p>
              )}
            </div>
            <span
              className={`text-label-sm px-3 py-1 rounded-full ${
                STATUS_COLORS[selected.consultation.status] ??
                "bg-surface-container text-on-surface-variant"
              }`}
            >
              {selected.consultation.status.charAt(0).toUpperCase() +
                selected.consultation.status.slice(1)}
            </span>
          </div>

          {selected.consultation.presentingComplaint && (
            <div className="mb-4">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-1">
                Consultation
              </p>
              <p className="text-body-md text-on-surface">
                {selected.consultation.presentingComplaint}
              </p>
            </div>
          )}

          {selected.consultation.responsePreview && (
            <div className="bg-surface-container rounded-lg p-4 mb-4">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide mb-2">
                Response
              </p>
              <p className="text-body-md text-on-surface whitespace-pre-wrap">
                {selected.consultation.responsePreview}
              </p>
            </div>
          )}

          {selected.notificationType === "rejected" && (
            <div className="bg-error-container text-on-error-container rounded-lg p-4 mb-4">
              <p className="font-semibold mb-1">Unable to complete remote assessment</p>
              <p className="text-body-sm">
                We recommend visiting a GP in person. A full refund has been initiated and will
                appear within 3–5 business days.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {(canViewResult || canDownloadPdf) && (
            <div className="flex flex-col gap-3 mt-5 pt-5 border-t border-outline-variant">
              {canViewResult && (
                <Link
                  href={`/consultation/${selected.consultation.id}/result`}
                  className="w-full text-center bg-primary text-on-primary rounded-lg py-3 font-semibold text-body-md hover:opacity-90"
                >
                  View Your Assessment
                </Link>
              )}
              {canDownloadPdf && (
                <button
                  onClick={() => downloadPdf(selected.consultation.id)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-secondary text-secondary rounded-lg py-3 font-semibold text-body-md hover:bg-secondary-container"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download PDF Summary
                </button>
              )}
            </div>
          )}

          <div className="border-t border-outline-variant pt-4 mt-4">
            <p className="text-body-sm text-on-surface-variant">
              This advice is not a substitute for in-person medical care. If your condition
              worsens, seek urgent care or call{" "}
              <span className="font-semibold text-error">000</span>.
            </p>
          </div>
        </div>

        <p className="text-body-sm text-on-surface-variant mt-4">
          Received{" "}
          {new Date(selected.sentAt).toLocaleString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="py-stack-lg">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-headline-md text-on-surface">Inbox</h1>
        {unreadCount > 0 && (
          <span className="bg-primary text-on-primary text-label-sm font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl block mb-3">inbox</span>
          <p className="text-body-lg">No messages yet</p>
          <p className="text-body-md mt-2">Your consultation responses will appear here.</p>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.notificationId}
              onClick={() => openItem(item)}
              className={`w-full text-left rounded-lg border p-4 transition-colors hover:border-secondary ${
                item.isUnread
                  ? "bg-surface-container border-primary"
                  : "bg-surface-container-lowest border-outline-variant"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.isUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                    <p className={`text-body-md truncate ${item.isUnread ? "font-semibold text-on-surface" : "text-on-surface"}`}>
                      {TYPE_LABELS[item.notificationType] ?? item.notificationType}
                    </p>
                  </div>
                  {item.consultation.presentingComplaint && (
                    <p className="text-body-sm text-on-surface-variant truncate">
                      {item.consultation.presentingComplaint}
                    </p>
                  )}
                  {item.consultation.doctorName && (
                    <p className="text-clinical-data text-on-surface-variant mt-1">
                      {item.consultation.doctorName}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-clinical-data text-on-surface-variant">
                    {new Date(item.sentAt).toLocaleDateString("en-AU")}
                  </p>
                  <span
                    className={`mt-1 inline-block text-label-sm px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[item.consultation.status] ??
                      "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {item.consultation.status.charAt(0).toUpperCase() +
                      item.consultation.status.slice(1)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        {showHasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="border border-outline text-on-surface px-6 py-2.5 rounded text-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
