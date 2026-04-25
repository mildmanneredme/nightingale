"use client";
import { useEffect, useState } from "react";
import { getRenewalQueue, approveRenewal, declineRenewal, RenewalQueueItem } from "@/lib/api";

const PAGE_LIMIT = 20;

export default function DoctorRenewalsPage() {
  const [items, setItems] = useState<RenewalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [validDays, setValidDays] = useState(28);
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRenewalQueue(PAGE_LIMIT, 0)
      .then((res) => {
        setItems(res.data);
        setHasMore(res.pagination.hasMore);
        setOffset(res.data.length);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await getRenewalQueue(PAGE_LIMIT, offset);
      setItems((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.hasMore);
      setOffset((prev) => prev + res.data.length);
    } finally {
      setLoadingMore(false);
    }
  }

  function openAction(id: string, m: "approve" | "decline") {
    setActionId(id);
    setMode(m);
    setReviewNote("");
    setValidDays(28);
  }

  async function handleSubmitAction() {
    if (!actionId || !mode) return;
    setSubmitting(true);
    try {
      if (mode === "approve") {
        await approveRenewal(actionId, reviewNote || undefined, validDays);
      } else {
        await declineRenewal(actionId, reviewNote || undefined);
      }
      setItems((prev) => prev.filter((i) => i.id !== actionId));
      setActionId(null);
      setMode(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;
  }

  const selected = items.find((i) => i.id === actionId);

  return (
    <div className="py-stack-lg max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-headline-md text-on-surface">Script Renewals</h1>
        {items.length > 0 && (
          <span className="bg-primary text-on-primary text-label-sm font-bold rounded-full px-2 py-0.5">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl block mb-3">medication</span>
          <p className="text-body-lg">No pending renewal requests</p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-container-lowest border rounded-xl p-5 ${
                item.isExpiryAlert ? "border-error" : "border-outline-variant"
              }`}
            >
              {item.isExpiryAlert && (
                <div className="flex items-center gap-2 mb-3 text-error text-label-md font-semibold">
                  <span className="material-symbols-outlined text-lg">warning</span>
                  Expiring within 48 hours
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-body-md font-semibold text-on-surface">
                    {item.medicationName}{item.dosage ? ` — ${item.dosage}` : ""}
                  </p>
                  <p className="text-clinical-data text-on-surface-variant mt-1">
                    Requested {new Date(item.createdAt).toLocaleDateString("en-AU")}
                  </p>
                </div>
                <div className="text-right text-body-sm text-on-surface-variant">
                  {item.patient.name && <p className="font-medium">{item.patient.name}</p>}
                  {item.patient.dob && <p>{new Date(item.patient.dob).toLocaleDateString("en-AU")}</p>}
                  {item.patient.sex && <p className="capitalize">{item.patient.sex}</p>}
                </div>
              </div>

              <div className="flex gap-3 mb-3 text-body-sm">
                <span className={`px-2 py-0.5 rounded-full ${item.noAdverseEffects ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>
                  {item.noAdverseEffects ? "No adverse effects" : "Adverse effects reported"}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${item.conditionUnchanged ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>
                  {item.conditionUnchanged ? "Condition unchanged" : "Condition changed"}
                </span>
              </div>

              {item.patientNotes && (
                <p className="text-body-sm text-on-surface-variant bg-surface-container rounded p-3 mb-3">
                  {item.patientNotes}
                </p>
              )}

              {actionId === item.id ? (
                <div className="border-t border-outline-variant pt-4 mt-2">
                  <p className="text-label-md text-on-surface-variant mb-2">
                    {mode === "approve" ? "Approve renewal" : "Decline renewal"}
                  </p>
                  {mode === "approve" && (
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-body-sm text-on-surface-variant">Valid for</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={validDays}
                        onChange={(e) => setValidDays(Number(e.target.value))}
                        className="w-16 border border-outline rounded px-2 py-1 text-body-sm bg-surface-container-lowest"
                      />
                      <span className="text-body-sm text-on-surface-variant">days</span>
                    </div>
                  )}
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder={mode === "approve" ? "Instructions for patient (optional)…" : "Reason for declining…"}
                    className="w-full border border-outline rounded px-3 py-2 text-body-sm bg-surface-container-lowest resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitAction}
                      disabled={submitting}
                      className={`px-4 py-2 rounded text-label-md font-semibold disabled:opacity-50 ${
                        mode === "approve"
                          ? "bg-primary text-on-primary"
                          : "bg-error text-on-error"
                      }`}
                    >
                      {submitting ? "Saving…" : mode === "approve" ? "Confirm Approval" : "Confirm Decline"}
                    </button>
                    <button
                      onClick={() => { setActionId(null); setMode(null); }}
                      className="text-on-surface-variant text-label-md px-3 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-outline-variant pt-3 mt-2">
                  <button
                    onClick={() => openAction(item.id, "approve")}
                    className="bg-primary text-on-primary px-4 py-1.5 rounded text-label-md font-semibold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => openAction(item.id, "decline")}
                    className="border border-outline text-on-surface px-4 py-1.5 rounded text-label-md"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 border border-outline text-on-surface px-6 py-2.5 rounded text-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
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
