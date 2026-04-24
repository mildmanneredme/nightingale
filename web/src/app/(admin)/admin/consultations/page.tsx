"use client";

import { useEffect, useState } from "react";
import {
  getAdminQueue,
  getAdminDoctors,
  reassignConsultation,
  AdminQueueItem,
  AdminDoctor,
  ApiError,
} from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

const ALERT_HOURS = 4;

function msInQueue(queuedAt: string): number {
  return Date.now() - new Date(queuedAt).getTime();
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ConsultationQueuePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AdminQueueItem[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([getAdminQueue(), getAdminDoctors()])
      .then(([queue, docs]) => {
        setItems(queue);
        setDoctors(docs);
      })
      .catch((e: unknown) => {
        const { title, detail } = e instanceof ApiError
          ? getErrorMessage(e.status)
          : getErrorMessage(0);
        toast.error(title, { detail, correlationId: e instanceof ApiError ? e.correlationId : undefined });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  async function handleReassign(consultationId: string, doctorId: string) {
    if (!doctorId) return;
    setReassigning((prev) => ({ ...prev, [consultationId]: true }));
    try {
      await reassignConsultation(consultationId, doctorId);
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== consultationId) return item;
          const doc = doctors.find((d) => d.id === doctorId);
          return {
            ...item,
            assignedDoctorId: doctorId,
            assignedDoctorName: doc?.name ?? null,
          };
        })
      );
    } catch (e: unknown) {
      const { title, detail } = e instanceof ApiError ? getErrorMessage(e.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: e instanceof ApiError ? e.correlationId : undefined });
    } finally {
      setReassigning((prev) => ({ ...prev, [consultationId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-500">Loading consultation queue…</div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Consultation Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} consultation{items.length !== 1 ? "s" : ""} awaiting doctor review
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Queue is empty — no consultations pending review.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Presenting Complaint</th>
                <th className="text-left px-4 py-3">Assigned Doctor</th>
                <th className="text-left px-4 py-3">Time in Queue</th>
                <th className="text-left px-4 py-3">Reassign</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const elapsed = msInQueue(item.queuedAt);
                const isLate = elapsed > ALERT_HOURS * 3_600_000;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-gray-50 ${isLate ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {item.patientInitials}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {item.presentingComplaint ?? <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.assignedDoctorName ?? (
                        <span className="text-gray-300 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          isLate ? "text-amber-600" : "text-gray-600"
                        }`}
                      >
                        {formatDuration(elapsed)}
                        {isLate && (
                          <span className="ml-1 text-xs bg-amber-100 text-amber-700 rounded px-1">
                            &gt;{ALERT_HOURS}h
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue=""
                          disabled={reassigning[item.id]}
                          onChange={(e) => handleReassign(item.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 disabled:opacity-50"
                        >
                          <option value="" disabled>
                            Select doctor…
                          </option>
                          {doctors.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.name}
                            </option>
                          ))}
                        </select>
                        {reassigning[item.id] && (
                          <span className="text-xs text-gray-400">Saving…</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
