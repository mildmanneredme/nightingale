"use client";
import Link from "next/link";
import { getAdminDoctorApplications, DoctorApplication } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

function StatusBadge({ status }: { status: DoctorApplication["status"] }) {
  const styles = {
    pending:  "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function DoctorApplicationsPage() {
  const { token } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-doctor-applications"],
    queryFn: getAdminDoctorApplications,
    enabled: !!token,
    staleTime: 0,
  });

  const applications = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Applications</h1>
          <p className="text-gray-500 mt-1">Pending AHPRA verification queue</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <span className="material-symbols-outlined text-4xl block mb-2 animate-spin">progress_activity</span>
          Loading…
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          Failed to load applications. <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="material-symbols-outlined text-5xl block mb-3">check_circle</span>
          <p className="font-semibold">No pending applications</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">AHPRA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Specialty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">State</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Applied</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{app.full_name}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{app.ahpra_number}</td>
                  <td className="px-4 py-3 text-gray-600">{app.specialty ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{app.primary_state ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(app.applied_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/doctors/applications/${app.id}`}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
