"use client";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";
import ConsultationStepper from "@/components/ConsultationStepper";
import { useNewConsultation } from "@/hooks/useNewConsultation";

export default function NewConsultationPage() {
  const { type, setType, loading, handleSubmit } = useNewConsultation();

  return (
    <>
      <TopAppBar activeNav="appointments" />

      <main className="pt-24 pb-32 px-4 md:px-patient-margin max-w-2xl mx-auto">
        {/* Stepper */}
        <div className="mb-8">
          <ConsultationStepper activeStep={1} />
        </div>

        <div className="mb-6">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-1">New Consultation</h1>
          <p className="font-body-lg text-on-surface-variant">
            Choose how you&apos;d like to speak with our clinical assistant.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Mode selection — two prominent cards */}
          <div>
            <h2 className="font-clinical-data text-xs text-on-surface-variant uppercase tracking-widest mb-3">
              Choose consultation mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Voice Call */}
              <button
                type="button"
                onClick={() => setType("voice")}
                className={`relative flex flex-col items-center gap-4 py-8 px-6 rounded-2xl border-2 transition-all text-center ${
                  type === "voice"
                    ? "border-secondary bg-secondary-container/20 shadow-md"
                    : "border-outline-variant bg-white hover:border-primary hover:shadow-sm"
                }`}
              >
                {type === "voice" && (
                  <div className="absolute top-3 right-3">
                    <span
                      className="material-symbols-outlined text-secondary text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>
                )}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    type === "voice"
                      ? "bg-secondary text-white shadow-lg shadow-secondary/30"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-4xl">mic</span>
                </div>
                <div>
                  <p className="font-manrope font-bold text-lg text-primary mb-1">Voice Call</p>
                  <p className="font-body-md text-on-surface-variant text-sm leading-snug">
                    Speak naturally about your symptoms with our AI clinical assistant.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] uppercase tracking-widest text-secondary bg-secondary-container/60 px-3 py-1 rounded-full">
                  Recommended
                </span>
              </button>

              {/* Text Chat */}
              <button
                type="button"
                onClick={() => setType("text")}
                className={`relative flex flex-col items-center gap-4 py-8 px-6 rounded-2xl border-2 transition-all text-center ${
                  type === "text"
                    ? "border-secondary bg-secondary-container/20 shadow-md"
                    : "border-outline-variant bg-white hover:border-primary hover:shadow-sm"
                }`}
              >
                {type === "text" && (
                  <div className="absolute top-3 right-3">
                    <span
                      className="material-symbols-outlined text-secondary text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>
                )}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    type === "text"
                      ? "bg-secondary text-white shadow-lg shadow-secondary/30"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-4xl">chat_bubble</span>
                </div>
                <div>
                  <p className="font-manrope font-bold text-lg text-primary mb-1">Text Chat</p>
                  <p className="font-body-md text-on-surface-variant text-sm leading-snug">
                    Prefer to type? Chat at your own pace with written responses.
                  </p>
                </div>
                <span className="font-label-sm text-[10px] uppercase tracking-widest text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                  Asynchronous
                </span>
              </button>
            </div>
          </div>

          {/* Fee note */}
          <div className="flex items-center gap-3 px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/40">
            <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">verified_user</span>
            <p className="font-body-md text-on-surface-variant text-sm">
              <span className="text-primary font-semibold">$50 AUD</span> — payment is only collected after your consultation if a diagnosis is reached.
            </p>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-primary text-white font-manrope font-bold text-lg rounded-2xl shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Commence Consultation"}
            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
          </button>

          {/* Safety guarantee */}
          <div className="flex gap-4 items-start p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-secondary text-2xl">medical_services</span>
            </div>
            <div>
              <h4 className="font-manrope font-bold text-primary mb-1">Clinical Safety Guarantee</h4>
              <p className="font-body-md text-on-surface-variant text-sm">
                Our triage system ensures you only pay for care that can be delivered safely online. If your case requires an in-person visit, we&apos;ll direct you to the nearest clinic at no cost.
              </p>
            </div>
          </div>

        </form>
      </main>

      <BottomNavBar active="health" />
    </>
  );
}
