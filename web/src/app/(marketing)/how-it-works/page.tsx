import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Nightingale",
  description: "Australia's premier asynchronous healthcare platform. Connect with AHPRA-registered doctors without the waiting room.",
};

export default function HowItWorksPage() {
  return (
    <main className="pb-24">
      {/* Hero Section */}
      <header className="text-center pt-16 mb-stack-lg px-6 max-w-5xl mx-auto">
        <h1 className="font-display-xl text-display-xl text-primary mb-4">The Digital Bedside Manner.</h1>
        <p className="font-body-lg text-body-lg text-outline max-w-2xl mx-auto">
          Australia&apos;s premier asynchronous healthcare platform. Connect with AHPRA-registered doctors for
          prescriptions, referrals, and medical advice without the waiting room.
        </p>
      </header>

      {/* Vertical Stepper Timeline */}
      <section className="mt-20 px-6 max-w-5xl mx-auto space-y-12 relative max-w-3xl">
        <div className="absolute left-[44px] top-4 bottom-4 w-px bg-outline-variant/30 hidden md:block" />

        {[
          {
            n: 1,
            title: "Initiate Consult",
            body: "Select your medical concern and complete a brief questionnaire. Your clinical history is captured securely for doctor review.",
          },
          {
            n: 2,
            title: "Doctor Assessment",
            body: "An Australian-qualified doctor reviews your submission within hours. They assess suitability based on clinical guidelines.",
          },
          {
            n: 3,
            title: "Treatment Plan",
            body: "If approved, you'll receive a digital prescription (eScript) or referral via SMS and email. Our doctors may request follow-up details.",
          },
          {
            n: 4,
            title: "Medication Delivery",
            body: "Take your eScript to any pharmacy, or opt for discreet express delivery straight to your door from our partner pharmacies.",
          },
          {
            n: 5,
            title: "Ongoing Care",
            body: "Need a follow-up? Chat with your doctor at any time through our secure patient portal. Your health records are centralised for easy access.",
          },
        ].map(({ n, title, body }) => (
          <div key={n} className="relative flex flex-col md:flex-row gap-gutter">
            <div className="z-10 bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 border-4 border-background">
              {n}
            </div>
            <div className="pt-1">
              <h3 className="font-headline-md text-headline-md text-primary mb-2">{title}</h3>
              <p className="font-body-md text-body-md text-outline">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Condition Tiles Grid */}
      <section className="mt-32 px-6 max-w-5xl mx-auto">
        <div className="mb-gutter text-center">
          <h2 className="font-headline-lg text-headline-lg text-primary">Conditions We Manage</h2>
          <p className="font-body-md text-body-md text-outline mt-2">Comprehensive care for common healthcare needs.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-stack-md">
          {[
            { icon: "medical_services", label: "General Health" },
            { icon: "ecg_heart", label: "Mental Health" },
            { icon: "pill", label: "Chronic Refills" },
            { icon: "dermatology", label: "Skin Concerns" },
            { icon: "female", label: "Reproductive" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="bg-surface-container-low border border-outline-variant p-gutter rounded-xl hover:bg-secondary-container transition-all group cursor-pointer"
            >
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 block">{icon}</span>
              <h4 className="font-label-sm text-label-sm text-primary group-hover:text-on-secondary-container">{label}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* What We Can't Help With */}
      <section className="mt-32 px-6 max-w-5xl mx-auto bg-error-container/50 border border-error rounded-2xl overflow-hidden">
        <div className="p-stack-lg flex flex-col md:flex-row items-start gap-gutter">
          <div className="bg-error text-on-error p-3 rounded-full flex-shrink-0">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-error mb-4">When Not To Use Nightingale</h2>
            <p className="font-body-md text-body-md text-on-error-container mb-gutter">
              Our platform is designed for non-emergency healthcare only. For your safety, we cannot provide care for the following:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-sm">
              {[
                "Medical Emergencies (Chest pain, Difficulty breathing)",
                "Schedule 8 (Controlled) Drug Prescriptions",
                "Complex Chronic Condition Management",
                "Conditions requiring physical examination",
                "Active injuries requiring urgent sutures or casting",
                "Mental health crises or acute suicidal ideation",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-on-error-container">
                  <span className="material-symbols-outlined text-sm">close</span>
                  <span className="font-clinical-data text-clinical-data">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-gutter p-gutter bg-white/40 rounded-xl border border-error/20">
              <p className="font-label-sm text-label-sm text-error uppercase tracking-widest mb-1">Emergency Protocol</p>
              <p className="font-body-md text-body-md text-on-error-container font-semibold">
                In case of emergency, immediately call 000 or visit your nearest Emergency Department.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Style Final CTA */}
      <section className="mt-32 px-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-stack-md">
        <div className="md:col-span-2 bg-primary text-white p-10 rounded-3xl flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-headline-lg text-headline-lg mb-4">Ready to experience the future of care?</h2>
            <p className="font-body-md opacity-80 mb-8 max-w-md">
              Join over 50,000 Australians who trust Nightingale for their everyday health needs.
            </p>
            <Link
              href="/register"
              className="inline-block bg-secondary text-white px-8 py-3 rounded-full font-bold hover:bg-secondary-fixed-dim transition-colors"
            >
              Start My Consultation
            </Link>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
        </div>
        <div className="bg-surface-container border border-outline-variant p-10 rounded-3xl flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-5xl text-primary mb-4">verified_user</span>
          <h3 className="font-headline-md text-headline-md text-primary mb-2">Safe &amp; Secure</h3>
          <p className="font-label-sm text-label-sm text-outline">AHPRA-Registered Doctors • 256-bit Encryption</p>
        </div>
      </section>
    </main>
  );
}
