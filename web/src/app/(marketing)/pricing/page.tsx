import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Nightingale",
  description: "Simple, transparent pricing. $50 AUD per consultation, reviewed by an AHPRA-registered GP.",
};

export default function PricingPage() {
  return (
    <main className="pt-16 pb-20">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 text-center mb-16">
        <h1 className="font-display-xl text-display-xl text-primary mb-6">Simple, transparent clinical care.</h1>
        <p className="font-body-lg text-body-lg text-outline max-w-2xl mx-auto">
          One flat fee for Australian patients. No hidden tiers, no complicated contracts. Just professional bedside
          manner in digital form.
        </p>
      </section>

      {/* Pricing Card */}
      <section className="max-w-7xl mx-auto px-6 mb-24 flex justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          {/* Decorative blur */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors" />

          <div className="relative z-10 text-center">
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container font-label-sm text-label-sm rounded-full mb-6">
              PRACTITIONER PLAN
            </span>

            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-display-xl font-display-xl text-primary">$50</span>
              <div className="text-left">
                <span className="block font-label-sm text-label-sm text-primary leading-tight">AUD</span>
                <span className="block font-body-md text-body-md text-outline">per consult</span>
              </div>
            </div>

            <p className="text-body-md font-body-md text-outline mb-8">
              Comprehensive consultation reviewed by a registered Australian GP.
            </p>

            <ul className="text-left space-y-4 mb-10">
              {[
                "AI-guided voice or text interview",
                "Photo upload for visible symptoms",
                "Full GP review and approval",
                "Written, doctor-attributed response",
                "24-48h follow-up check-in",
                "Secure encrypted health record",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="font-body-md text-on-surface">{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="block w-full bg-primary text-on-primary py-4 rounded-2xl font-headline-md text-body-md hover:opacity-90 transition-opacity text-center"
            >
              Get Started
            </Link>
            <p className="mt-4 font-label-sm text-label-sm text-outline">Free during beta period.</p>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-6 mb-24">
        <div className="text-center mb-12">
          <h2 className="font-headline-lg text-headline-lg text-primary">How we compare</h2>
          <p className="font-body-md text-body-md text-outline">Clinical precision meets modern software design.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-surface-container border-b border-slate-200">
            <div className="p-6 font-label-sm text-label-sm text-outline uppercase tracking-wider">Features</div>
            <div className="p-6 font-label-sm text-label-sm text-primary flex items-center justify-center gap-2">
              <span className="text-xl font-bold">Nightingale</span>
            </div>
            <div className="p-6 font-label-sm text-label-sm text-outline flex items-center justify-center">
              Traditional Care
            </div>
          </div>

          {[
            { feature: "Patient Experience", nightingale: "Human-Centric Focus", other: "Clinical/Sterile", highlight: true },
            { feature: "Availability", nightingale: "24 / 7", other: "Business hours", highlight: false },
            { feature: "Wait time", nightingale: "Hours", other: "1–2 weeks", highlight: false },
            { feature: "Pricing Transparency", nightingale: "Flat $50 AUD", other: "Variable", highlight: false },
          ].map(({ feature, nightingale, other, highlight }, i) => (
            <div
              key={feature}
              className={`grid grid-cols-3 ${i % 2 === 1 ? "bg-surface-container-low/50" : ""}`}
            >
              <div className="p-6 font-body-md text-on-surface border-r border-slate-100">{feature}</div>
              <div className={`p-6 flex justify-center border-r border-slate-100 ${highlight ? "text-secondary font-clinical-data text-clinical-data" : "text-secondary font-clinical-data text-clinical-data"}`}>
                {nightingale}
              </div>
              <div className="p-6 flex justify-center text-outline font-body-md">{other}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Refund Policy */}
      <section className="max-w-3xl mx-auto px-6">
        <div className="bg-surface-container-low border border-slate-100 p-8 rounded-3xl flex items-start gap-6">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-secondary">policy</span>
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Our Refund Policy</h3>
            <p className="font-body-md text-body-md text-outline">
              If your consultation is declined because it falls outside our clinical scope, you will not be charged.
              Nightingale is committed to fair, transparent billing for every Australian patient.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
