"use client";
import { useState } from "react";
import { getRenewals, submitRenewal, RenewalRequest, ApiError } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

const PAGE_LIMIT = 20;

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting Review",
  approved: "Approved",
  declined: "Declined",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-surface-container text-on-surface-variant",
  approved: "bg-secondary-container text-on-secondary-container",
  declined: "bg-error-container text-on-error-container",
};

export default function RenewalsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [extraRenewals, setExtraRenewals] = useState<RenewalRequest[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form fields
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [noAdverseEffects, setNoAdverseEffects] = useState(true);
  const [conditionUnchanged, setConditionUnchanged] = useState(true);
  const [patientNotes, setPatientNotes] = useState("");

  // F-053: useQuery for initial fetch; F-056: use isLoading from query
  const { data: initialData, isLoading: loading } = useQuery({
    queryKey: ["renewals"],
    queryFn: () => getRenewals(PAGE_LIMIT, 0),
    enabled: !!token,
  });

  const initialRenewals = initialData?.data ?? [];
  const initialHasMore = initialData?.pagination.hasMore ?? false;
  const renewals = [...initialRenewals, ...extraRenewals];
  const showHasMore = hasMore ?? initialHasMore;
  const effectiveOffset = offset === 0 ? initialRenewals.length : offset;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await getRenewals(PAGE_LIMIT, effectiveOffset);
      setExtraRenewals((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.hasMore);
      setOffset(effectiveOffset + res.data.length);
    } finally {
      setLoadingMore(false);
    }
  }

  // F-054: useMutation with invalidateQueries on success
  const submitMutation = useMutation({
    mutationFn: (data: {
      medicationName: string;
      dosage?: string;
      noAdverseEffects: boolean;
      conditionUnchanged: boolean;
      patientNotes?: string;
    }) => submitRenewal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renewals"] });
      setExtraRenewals([]);
      setHasMore(null);
      setOffset(0);
      setShowForm(false);
      setMedicationName("");
      setDosage("");
      setPatientNotes("");
    },
    onError: (err: unknown) => {
      const { title, detail } = err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: err instanceof ApiError ? err.correlationId : undefined });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medicationName.trim()) { setValidationError("Medication name is required"); return; }
    if (!noAdverseEffects || !conditionUnchanged) {
      setValidationError("If you have experienced adverse effects or your condition has changed, please start a new consultation.");
      return;
    }
    setValidationError(null);
    submitMutation.mutate({
      medicationName: medicationName.trim(),
      dosage: dosage.trim() || undefined,
      noAdverseEffects,
      conditionUnchanged,
      patientNotes: patientNotes.trim() || undefined,
    });
  }

  if (loading) {
    return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;
  }

  return (
    <div className="py-stack-lg max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-headline-md text-on-surface">Script Renewals</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-on-primary px-4 py-2 rounded text-label-md font-semibold"
          >
            Request Renewal
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-8">
          <h2 className="font-display text-title-lg text-on-surface mb-4">New Renewal Request</h2>

          <div className="bg-tertiary-container text-on-tertiary-container rounded-lg p-4 mb-6 text-body-sm">
            Script renewals are only available for medications previously recommended by a Nightingale doctor.
            If your condition has changed, please start a new consultation.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">
                Medication name *
              </label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                className="w-full border border-outline rounded px-3 py-2 text-body-md bg-surface-container-lowest"
                placeholder="e.g. Metformin"
                required
              />
            </div>

            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">
                Dosage (optional)
              </label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full border border-outline rounded px-3 py-2 text-body-md bg-surface-container-lowest"
                placeholder="e.g. 500mg twice daily"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={noAdverseEffects}
                  onChange={(e) => setNoAdverseEffects(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-body-sm text-on-surface">
                  I have not experienced any adverse effects from this medication since my last prescription.
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={conditionUnchanged}
                  onChange={(e) => setConditionUnchanged(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-body-sm text-on-surface">
                  My condition has not changed significantly since my last consultation.
                </span>
              </label>
            </div>

            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">
                Additional notes (optional)
              </label>
              <textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={3}
                className="w-full border border-outline rounded px-3 py-2 text-body-md bg-surface-container-lowest resize-none"
                placeholder="Any updates for the reviewing doctor…"
              />
            </div>

            {validationError && (
              <p className="text-body-sm text-error">{validationError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="bg-primary text-on-primary px-6 py-2 rounded text-label-md font-semibold disabled:opacity-50"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-on-surface-variant text-label-md px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {renewals.length === 0 && !showForm && !loading ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl block mb-3">medication</span>
          <p className="text-body-lg">No renewal requests</p>
          <p className="text-body-md mt-2">Request a renewal for a medication previously prescribed by a Nightingale doctor.</p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {renewals.map((r) => (
            <div
              key={r.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body-md font-semibold text-on-surface">
                    {r.medicationName}{r.dosage ? ` — ${r.dosage}` : ""}
                  </p>
                  {r.reviewNote && (
                    <p className="text-body-sm text-on-surface-variant mt-1">{r.reviewNote}</p>
                  )}
                  {r.validUntil && r.status === "approved" && (
                    <p className="text-clinical-data text-on-surface-variant mt-1">
                      Valid until {new Date(r.validUntil).toLocaleDateString("en-AU")}
                    </p>
                  )}
                  {r.doctorName && (
                    <p className="text-clinical-data text-secondary mt-1">{r.doctorName}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-label-sm px-3 py-1 rounded-full ${
                      STATUS_COLORS[r.status] ?? "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <p className="text-clinical-data text-on-surface-variant mt-2">
                    {new Date(r.createdAt).toLocaleDateString("en-AU")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {showHasMore && (
          <div className="mt-6 flex justify-center">
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
