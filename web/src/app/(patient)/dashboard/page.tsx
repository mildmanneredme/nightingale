"use client";
import { useState } from "react";
import Link from "next/link";
import { getConsultations, Consultation, getToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";
import StatusBadge from "@/components/StatusBadge";

const PDF_STATUSES = new Set(["approved", "amended"]);

async function downloadPdf(id: string) {
  const token = getToken();
  const res = await fetch(`/api/v1/consultations/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultation-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [extraConsultations, setExtraConsultations] = useState<Consultation[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [consultOffset, setConsultOffset] = useState(0);

  // F-053: use useQuery for the initial fetch; F-056: use isLoading from query
  const { data: initialData, isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => getConsultations(20, 0),
    staleTime: 30_000,
    enabled: !!token,
  });

  const initialConsultations = initialData?.data ?? [];
  const initialHasMore = initialData?.pagination.hasMore ?? false;
  const consultations = [...initialConsultations, ...extraConsultations];
  const showHasMore = hasMore ?? initialHasMore;
  const effectiveOffset = consultOffset === 0 ? initialConsultations.length : consultOffset;

  async function loadMoreConsultations() {
    setLoadingMore(true);
    try {
      const res = await getConsultations(20, effectiveOffset);
      setExtraConsultations((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.hasMore);
      setConsultOffset(effectiveOffset + res.data.length);
    } finally {
      setLoadingMore(false);
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <TopAppBar activeNav="health" />

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-7xl mx-auto">
        {/* Welcome */}
        <section className="mb-stack-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary">{greeting}</h1>
          <p className="font-body-md text-on-surface-variant mt-1">
            Here is an overview of your health status and upcoming consultations.
          </p>
        </section>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-gutter">

          {/* CTA Card */}
          <div
            className="col-span-12 lg:col-span-8 rounded-xl p-8 relative overflow-hidden"
            style={{ backgroundImage: "url('/dashboard-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="relative z-10 flex flex-col h-full justify-between min-h-[240px]">
              <div>
                <h2 className="font-headline-md text-headline-md text-white mb-2">Need medical advice?</h2>
                <p className="text-primary-fixed-dim font-body-md max-w-md">
                  Connect with a qualified practitioner in minutes. Our digital bedside manner ensures you&apos;re heard and cared for.
                </p>
              </div>
              <Link
                href="/consultation/new"
                className="mt-8 bg-secondary-fixed text-on-secondary-fixed px-8 py-4 rounded-xl font-bold flex items-center gap-2 self-start hover:scale-105 transition-transform active:scale-95 shadow-lg"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                Start New Consultation
              </Link>
            </div>
          </div>

          {/* Profile completeness */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl p-6 border border-slate-100 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-secondary font-bold text-xs uppercase tracking-wider">Health Profile</span>
                <span className="text-primary font-bold text-sm">85% Complete</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6">
                <div className="bg-secondary h-full rounded-full w-[85%] transition-all duration-1000" />
              </div>
              <p className="font-body-md text-on-surface-variant mb-4 text-sm">
                Complete your medical history to help our doctors provide better care.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/profile"
                className="flex items-center gap-3 p-3 bg-secondary-container/30 rounded-lg border border-secondary-container/50 hover:bg-secondary-container/50 transition-colors"
              >
                <span className="material-symbols-outlined text-secondary">check_circle</span>
                <span className="font-clinical-data text-on-secondary-container">Personal details</span>
                <span className="material-symbols-outlined text-secondary ml-auto text-[16px]">arrow_forward</span>
              </Link>
              <Link
                href="/history"
                className="flex items-center gap-3 p-3 bg-surface-container rounded-lg border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-outline">pending</span>
                <span className="font-clinical-data text-on-surface-variant">Update medical history</span>
                <span className="material-symbols-outlined text-outline ml-auto text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* Consultation History table */}
          <div className="col-span-12 bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-primary">Consultation History</h3>
              <Link href="/history" className="text-secondary font-bold text-sm hover:underline">
                View All
              </Link>
            </div>

            {isLoading ? (
              <div className="px-6 py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2 animate-spin">progress_activity</span>
                Loading…
              </div>
            ) : consultations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant block mb-3">medical_services</span>
                <p className="font-body-lg text-on-surface mb-2">No consultations yet</p>
                <p className="font-body-md text-on-surface-variant mb-6">
                  Start your first consultation to get a doctor-reviewed assessment.
                </p>
                <Link
                  href="/consultation/new"
                  className="inline-flex items-center gap-2 bg-primary text-white font-bold rounded-xl py-3 px-6 hover:opacity-90"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                  Start a Consultation
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 font-label-sm text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 font-label-sm text-slate-500 uppercase tracking-widest">Complaint</th>
                      <th className="px-6 py-4 font-label-sm text-slate-500 uppercase tracking-widest hidden md:table-cell">Type</th>
                      <th className="px-6 py-4 font-label-sm text-slate-500 uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-clinical-data text-primary">
                              {new Date(c.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(c.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <Link href={`/consultation/${c.id}/result`} className="block">
                            <span className="font-body-md text-primary font-medium line-clamp-1">
                              {c.presentingComplaint ?? "No complaint recorded"}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-5 hidden md:table-cell">
                          <span className="font-clinical-data text-on-surface-variant capitalize">
                            {c.consultationType}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <StatusBadge status={c.status} />
                            {PDF_STATUSES.has(c.status) && (
                              <button
                                onClick={() => downloadPdf(c.id)}
                                className="text-secondary hover:opacity-70 transition-opacity"
                                title="Download PDF"
                              >
                                <span className="material-symbols-outlined text-base">download</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {showHasMore && (
                  <div className="px-6 py-4 border-t border-slate-50 flex justify-center">
                    <button
                      onClick={loadMoreConsultations}
                      disabled={loadingMore}
                      className="text-primary font-bold text-sm hover:underline disabled:opacity-50"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vitals Snapshot */}
          <div className="col-span-12 md:col-span-6 bg-white rounded-xl p-6 border border-slate-100 shadow-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                <span className="material-symbols-outlined">monitor_heart</span>
              </div>
              <div>
                <h4 className="font-clinical-data text-primary">Vitals Snapshot</h4>
                <p className="text-xs text-slate-400">Last sync: 2 hours ago</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Heart Rate</p>
                <p className="font-headline-md text-headline-md text-primary">72 <span className="text-sm font-normal text-slate-400">bpm</span></p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Sleep</p>
                <p className="font-headline-md text-headline-md text-primary">7.5 <span className="text-sm font-normal text-slate-400">hrs</span></p>
              </div>
            </div>
          </div>

          {/* Telehealth Tip */}
          <div className="col-span-12 md:col-span-6 bg-secondary-container/20 rounded-xl p-6 border border-secondary-container/30 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-headline-md text-headline-md text-primary mb-2">Preparing for your call</h4>
              <p className="font-body-md text-on-secondary-container mb-4">
                Ensure a quiet space and stable internet connection for your virtual appointment.
              </p>
              <Link
                href="/consultation/new"
                className="inline-flex items-center gap-1 text-secondary font-bold text-sm hover:gap-2 transition-all"
              >
                Start a consultation <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
            <span
              className="material-symbols-outlined absolute -bottom-4 -right-4 text-[128px] leading-none"
              style={{ color: "rgba(19,105,106,0.1)" }}
            >
              videocam
            </span>
          </div>

        </div>
      </main>

      {/* FAB (mobile) */}
      <Link
        href="/consultation/new"
        className="fixed bottom-24 right-6 md:hidden bg-primary text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">add</span>
      </Link>

      <BottomNavBar active="home" />
    </>
  );
}
