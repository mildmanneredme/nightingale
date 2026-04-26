"use client";

export default function ForDoctorsPage() {
  return (
    <main className="pt-0">
      {/* Hero Section: Full-bleed background */}
      <section className="relative py-32 overflow-hidden min-h-[600px] flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="/doctor-feature-page.png"
        />
        {/* Gradient: image shows on left, white fade on right for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/60 to-white" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex justify-end">
          <div className="max-w-lg flex flex-col space-y-8">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm w-fit">
              PRACTITIONER PLATFORM
            </div>
            <h1 className="font-display-xl text-primary leading-tight">
              Modern medicine. <br />
              <span className="text-secondary">Minimal paperwork.</span>
            </h1>
            <p className="text-body-lg text-slate-600">
              Nightingale is the primary care operating system designed by Australian doctors. We handle the admin and
              patient logistics so you can focus on the medicine.
            </p>

            <div className="grid grid-cols-1 gap-6">
              {[
                {
                  icon: "bolt",
                  color: "bg-primary-container text-on-primary-container",
                  title: "2–5 min per review",
                  body: "AI-structured clinical summaries mean you have everything you need to make a sound clinical decision, fast.",
                },
                {
                  icon: "payments",
                  color: "bg-secondary-container text-on-secondary-container",
                  title: "$15 per consultation",
                  body: "Earn revenue on your schedule. No patient-facing calls. Review from anywhere with an internet connection.",
                },
              ].map(({ icon, color, title, body }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white transition-colors border border-transparent hover:border-slate-100"
                >
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${color}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-slate-900 text-lg">{title}</h3>
                    <p className="text-slate-500">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <a
                href="mailto:doctors@nightingale.health?subject=GP Partner Interest"
                className="px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
              >
                Apply to Practice
              </a>
              <a
                href="#demo"
                className="px-8 py-4 bg-white text-slate-900 font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
              >
                View Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Share Callout */}
      <section className="bg-primary py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 md:p-20 overflow-hidden relative">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-secondary/20 rounded-full blur-[100px]" />
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-headline-lg text-white mb-6">Keep more of what you earn.</h2>
                <p className="text-body-lg text-slate-300 mb-10">
                  We believe in a fair partnership. Nightingale pays a flat $15 per consultation review, leaving
                  earnings directly in the hands of the practitioners who provide the care.
                </p>
                <div className="flex flex-wrap gap-12">
                  <div>
                    <div className="text-4xl font-bold text-secondary">$15</div>
                    <div className="text-slate-400 font-label-sm mt-2 uppercase tracking-widest">Per Review</div>
                  </div>
                  <div className="w-px h-16 bg-white/10 hidden md:block" />
                  <div>
                    <div className="text-4xl font-bold text-white">2–5m</div>
                    <div className="text-slate-400 font-label-sm mt-2 uppercase tracking-widest">Per Consultation</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="font-clinical-data text-primary">Earnings Projection</h4>
                  <span className="material-symbols-outlined text-slate-300">trending_up</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-clinical-data mb-2">
                      <span className="text-slate-500">10 reviews/day, 5 days</span>
                      <span className="text-secondary font-bold">$750 / week</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary w-[75%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-clinical-data mb-2">
                      <span className="text-slate-500">5 reviews/day, 5 days</span>
                      <span className="text-primary font-bold">$375 / week</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[37%]" />
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-100">
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      At $15 per review. Flexible hours — review as many or as few as you choose.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor Workflow 3-Steps */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center mb-20">
          <h2 className="font-display-xl text-primary mb-4">Focus on the patient, not the platform.</h2>
          <p className="text-body-lg text-slate-500 max-w-2xl mx-auto">Three steps to a more sustainable clinical practice.</p>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            {
              n: "01",
              icon: "calendar_today",
              color: "bg-secondary text-white shadow-secondary/20",
              title: "Set Your Schedule",
              body: "Choose your availability windows. Our smart-routing matches you with cases that fall within your clinical scope.",
            },
            {
              n: "02",
              icon: "stethoscope",
              color: "bg-primary text-white shadow-primary/20",
              title: "Review the Case",
              body: "Access full patient history and the AI-structured SOAP summary in one view. Approve, amend, or reject in minutes.",
            },
            {
              n: "03",
              icon: "account_balance_wallet",
              color: "bg-on-tertiary-container text-white shadow-on-tertiary-container/20",
              title: "Automatic Payouts",
              body: "No reconciliation, no chasing invoices. Payments settled directly to your account.",
            },
          ].map(({ n, icon, color, title, body }) => (
            <div key={n} className="relative group">
              <div className="text-9xl font-extrabold text-slate-50 absolute -top-12 -left-4 z-0 select-none">{n}</div>
              <div className="relative z-10">
                <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center mb-8 shadow-lg`}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {icon}
                  </span>
                </div>
                <h3 className="font-headline-md text-primary mb-4">{title}</h3>
                <p className="text-body-md text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interest Form */}
      <section id="demo" className="py-32 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-[2rem] p-12 shadow-xl border border-slate-200">
            <div className="text-center mb-12">
              <h2 className="font-headline-lg text-primary mb-4">Request a Clinical Demo</h2>
              <p className="text-slate-500">Join our network of Australian medical professionals.</p>
            </div>
            <form
              action="mailto:doctors@nightingale.health"
              method="get"
              encType="text/plain"
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-label-sm text-slate-700 ml-1 block">FULL NAME</label>
                  <input
                    className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    placeholder="Dr. Julian Smith"
                    type="text"
                    name="name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-sm text-slate-700 ml-1 block">AHPRA NUMBER</label>
                  <input
                    className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    placeholder="MED000123456"
                    type="text"
                    name="ahpra"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-label-sm text-slate-700 ml-1 block">PROFESSIONAL EMAIL</label>
                <input
                  className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="smith.j@medicalclinic.com.au"
                  type="email"
                  name="email"
                />
              </div>
              <div className="space-y-2">
                <label className="font-label-sm text-slate-700 ml-1 block">PRACTICE SPECIALTY</label>
                <select
                  className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-white"
                  name="specialty"
                >
                  <option>General Practice</option>
                  <option>Psychiatry</option>
                  <option>Paediatrics</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-5 bg-primary text-white font-bold rounded-xl text-lg hover:bg-slate-900 transition-colors shadow-lg"
                >
                  Submit Application
                </button>
              </div>
              <p className="text-center text-xs text-slate-400 mt-6">
                By submitting, you agree to our Terms of Service and Privacy Policy for Practitioners.
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
