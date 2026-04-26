import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Emergency Strip */}
      <div className="bg-error text-on-error py-2 px-6 text-center font-label-sm sticky top-0 z-[60]">
        Medical emergency? Call 000.
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[870px] flex items-center justify-center overflow-hidden">
        {/* Background image with gradient overlay */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover opacity-10"
            src="/landing-bg.png"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/50 to-white" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center space-y-stack-lg">
          <div className="inline-flex items-center gap-2 bg-secondary-container/30 border border-secondary-container px-4 py-1.5 rounded-full text-secondary font-label-sm">
            <span className="flex h-2 w-2 rounded-full bg-secondary" />
            Trusted Australian Healthcare
          </div>

          <h1 className="font-display-xl text-display-xl text-primary max-w-4xl mx-auto">
            Healthcare that feels human. <br />
            <span className="text-secondary">Available now.</span>
          </h1>

          <p className="font-body-lg text-body-lg text-outline max-w-2xl mx-auto">
            Connect with leading Australian practitioners instantly. Digital bedside manner meets medical authority.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="bg-secondary text-white px-8 py-4 rounded-full font-label-sm text-lg flex items-center gap-2 hover:shadow-xl hover:shadow-secondary/20 transition-all scale-95 active:scale-90"
            >
              Get Started ($50)
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <Link
              href="/how-it-works"
              className="bg-white border border-outline-variant text-primary px-8 py-4 rounded-full font-label-sm text-lg hover:bg-surface-container transition-all"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Band — qualitative only; no numerical claims until real metrics are wired */}
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "verified_user", label: "AHPRA-registered Australian doctors" },
              { icon: "shield_lock", label: "End-to-end encrypted, hosted in Australia" },
              { icon: "medical_services", label: "Doctor-reviewed before any advice reaches you" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 justify-center text-on-primary-container">
                <span className="material-symbols-outlined text-secondary-fixed">{icon}</span>
                <span className="font-label-sm uppercase tracking-widest text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works (Bento Style) */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-headline-lg text-headline-lg text-primary">How It Works</h2>
          <p className="font-body-md text-outline">Three simple steps to better health.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[
            {
              icon: "description",
              title: "1. Quick Check-in",
              body: "Complete a brief digital assessment about your symptoms and medical history.",
            },
            {
              icon: "stethoscope",
              title: "2. Doctor Review",
              body: "A registered Australian GP reviews your case and creates a personalized plan.",
            },
            {
              icon: "medication",
              title: "3. Fast Delivery",
              body: "Get your prescription or treatment plan delivered discreetly to your door.",
            },
          ].map(({ icon, title, body }) => (
            <div
              key={title}
              className="bg-white border border-outline-variant p-10 rounded-xl space-y-4 hover:border-secondary transition-colors group"
            >
              <div className="bg-secondary-container w-12 h-12 rounded-lg flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">{icon}</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary">{title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for — 2-col split */}
      <section className="bg-surface-container py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full aspect-square object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYFEszUofxLegwyDSOslWNZJpKGm5KK5RecEV58ojbxaBMywkBSul5PNi_IdlKWX1JCSyY5Xiu2HwO60a0G5O39RFzOHnznq9dO4tygK1qhmsxJQxhfGebA5eEhDMNwolPs5jQopoIMmrqa9HZqg_WK3wSD5ja6r8UQM0Fgo-t33wsfkvoQre3HUDe_IZb6Gk7HsDPdk-L9OKeEzoez_jWG3RT3-MF24awq9cmyKJhlLD9VVKYhgu4_U1CnTgMUDSk6pTpACIgy0Fi"
                alt="Australian doctor in a modern clinic"
              />
            </div>
            <div className="space-y-stack-lg">
              <h2 className="font-display-xl text-display-xl text-primary">For patients, by doctors.</h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="bg-primary-container p-3 rounded-lg h-fit text-on-primary-container">
                    <span className="material-symbols-outlined">verified_user</span>
                  </div>
                  <div>
                    <h4 className="font-headline-md text-primary text-xl">For Busy Professionals</h4>
                    <p className="font-body-md text-on-surface-variant">Skip the waiting room. Access healthcare around your schedule, not ours.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-primary-container p-3 rounded-lg h-fit text-on-primary-container">
                    <span className="material-symbols-outlined">family_restroom</span>
                  </div>
                  <div>
                    <h4 className="font-headline-md text-primary text-xl">For Modern Families</h4>
                    <p className="font-body-md text-on-surface-variant">Reliable medical advice for the whole household, just a message away.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Callout Card */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-secondary text-on-secondary rounded-[2rem] p-12 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <span className="material-symbols-outlined text-[120px]">security</span>
          </div>
          <div className="relative z-10 max-w-2xl space-y-6">
            <h2 className="font-headline-lg text-white">Your safety is our priority.</h2>
            <p className="font-body-lg text-secondary-fixed">
              Every consultation is handled with the highest clinical standards. We use bank-grade encryption and adhere to all Australian health privacy regulations.
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div className="text-sm font-label-sm text-on-secondary/80">
                Reviewed by AHPRA registered practitioners
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA Banner */}
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto bg-primary text-on-primary rounded-3xl p-16 text-center space-y-8 border border-white/10">
          <h2 className="font-display-xl text-display-xl">Ready to start your first consult?</h2>
          <p className="font-body-lg text-on-primary-container">Join thousands of Australians getting better healthcare.</p>
          <Link
            href="/register"
            className="inline-block bg-secondary text-white px-12 py-5 rounded-full font-label-sm text-xl hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
          >
            Get Started ($50)
          </Link>
        </div>
      </section>
    </>
  );
}
