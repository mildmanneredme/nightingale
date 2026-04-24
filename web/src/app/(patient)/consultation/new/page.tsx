"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";

const MAX_CHARS = 200;

export default function NewConsultationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [complaint, setComplaint] = useState("");
  const [type, setType] = useState<"voice" | "text">("voice");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const consultation = await createConsultation(type, complaint || undefined);
      if (type === "voice") {
        router.push(`/consultation/${consultation.id}/audio-check`);
      } else {
        router.push(`/consultation/${consultation.id}/text`);
      }
    } catch (err: unknown) {
      const { title, detail } = err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, { detail, correlationId: err instanceof ApiError ? err.correlationId : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopAppBar activeNav="appointments" />

      <main className="pt-24 pb-32 px-6 md:px-patient-margin max-w-4xl mx-auto">
        {/* Progress stepper */}
        <div className="flex items-center gap-4 mb-stack-lg overflow-x-auto pb-2">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-xs">1</span>
            <span className="font-label-sm text-secondary uppercase tracking-widest">Description</span>
          </div>
          <div className="w-12 h-[2px] bg-outline-variant shrink-0" />
          <div className="flex items-center gap-2 shrink-0 opacity-50">
            <span className="w-8 h-8 rounded-full border-2 border-outline flex items-center justify-center font-bold text-xs text-on-surface">2</span>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-widest">Provider</span>
          </div>
          <div className="w-12 h-[2px] bg-outline-variant shrink-0" />
          <div className="flex items-center gap-2 shrink-0 opacity-50">
            <span className="w-8 h-8 rounded-full border-2 border-outline flex items-center justify-center font-bold text-xs text-on-surface">3</span>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-widest">Payment</span>
          </div>
        </div>

        <section className="space-y-stack-lg">
          <div>
            <h1 className="font-manrope text-headline-lg text-primary mb-2">New Consultation</h1>
            <p className="font-body-lg text-on-surface-variant">
              Tell us what&apos;s happening so we can match you with the right specialist.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">

              {/* Main input card */}
              <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-stack-md shadow-card hover:shadow-md transition-shadow">
                <label htmlFor="reason" className="block font-manrope text-headline-md text-primary mb-4">
                  What brings you in today?
                </label>
                <div className="relative">
                  <textarea
                    id="reason"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value.slice(0, MAX_CHARS))}
                    rows={6}
                    className="w-full bg-surface-bright border-2 border-outline-variant focus:border-primary focus:ring-0 rounded-lg p-4 font-body-md text-on-surface transition-all resize-none outline-none"
                    placeholder="Please describe your symptoms, duration, and any concerns…"
                  />
                  <div className="absolute bottom-4 right-4 font-label-sm text-outline text-xs">
                    {complaint.length} / {MAX_CHARS}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-on-secondary-container bg-secondary-container/30 p-3 rounded-lg">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <p className="font-label-sm text-[12px]">Specific details help our doctors provide a faster assessment.</p>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="md:col-span-4 flex flex-col gap-gutter">

                {/* Mode selection */}
                <div className="bg-white border border-slate-200 rounded-xl p-stack-md shadow-card">
                  <h3 className="font-clinical-data text-primary uppercase tracking-widest mb-4 text-xs">Consultation Mode</h3>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setType("voice")}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        type === "voice"
                          ? "border-secondary bg-secondary-container/20 text-on-secondary-container"
                          : "border-outline-variant bg-surface-bright text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        type === "voice" ? "bg-secondary text-white" : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        <span className="material-symbols-outlined">mic</span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-clinical-data text-sm">Voice Call</p>
                        <p className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">Recommended</p>
                      </div>
                      {type === "voice" && (
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setType("text")}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        type === "text"
                          ? "border-secondary bg-secondary-container/20 text-on-secondary-container"
                          : "border-outline-variant bg-surface-bright text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        type === "text" ? "bg-secondary text-white" : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        <span className="material-symbols-outlined">chat_bubble</span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-clinical-data text-sm">Text Chat</p>
                        <p className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">Asynchronous</p>
                      </div>
                      {type === "text" && (
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Fee summary */}
                <div className="bg-primary text-white rounded-xl p-stack-md shadow-lg overflow-hidden relative">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                  <h3 className="font-label-sm text-[11px] uppercase tracking-widest text-on-primary-container mb-2">Estimated Fee</h3>
                  <div className="font-manrope text-[48px] font-bold leading-tight mb-4">
                    $50<span className="text-headline-md opacity-70">.00</span>
                    <span className="font-label-sm text-xs align-middle ml-1">AUD</span>
                  </div>
                  <div className="flex items-start gap-2 bg-white/10 p-3 rounded-lg border border-white/20">
                    <span className="material-symbols-outlined text-secondary-fixed text-[18px] shrink-0">verified_user</span>
                    <p className="text-[11px] leading-relaxed font-body-md">
                      Full refund if the doctor cannot assess your condition remotely.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action area */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-stack-md border-t border-slate-200 mt-stack-lg">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">stethoscope</span>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">medical_services</span>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +12
                  </div>
                </div>
                <div>
                  <p className="font-clinical-data text-primary text-sm">Available Practitioners</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Typical wait time: <span className="text-secondary font-bold">~8 mins</span>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-10 py-4 bg-primary text-white font-manrope font-bold text-lg rounded-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? "Starting…" : "Continue to Payment"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </div>
          </form>

          {/* Safety guarantee */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-6 items-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-secondary text-3xl">medical_services</span>
            </div>
            <div>
              <h4 className="font-manrope text-headline-md text-primary mb-1">Clinical Safety Guarantee</h4>
              <p className="font-body-md text-on-surface-variant">
                Our triage system ensures you only pay for care that can be delivered safely online. If your case requires an in-person visit, we&apos;ll direct you to the nearest clinic at no cost.
              </p>
            </div>
          </div>
        </section>
      </main>

      <BottomNavBar active="health" />
    </>
  );
}
