import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white font-manrope text-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-6 pt-20 pb-10 max-w-7xl mx-auto">
        <div className="md:col-span-1 space-y-4">
          <div className="font-bold text-slate-900 text-xl">Nightingale</div>
          <p className="text-slate-500 leading-relaxed">
            Transforming the Australian medical landscape through digital innovation and clinical excellence.
          </p>
        </div>

        <div>
          <h5 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Platform</h5>
          <ul className="space-y-3">
            {[
              { href: "/how-it-works", label: "How It Works" },
              { href: "/pricing", label: "Pricing" },
              { href: "/safety", label: "Safety & Trust" },
              { href: "/faq", label: "FAQ" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-slate-500 hover:underline transition-all">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Company</h5>
          <ul className="space-y-3">
            {[
              { href: "/about", label: "About" },
              { href: "/for-doctors", label: "For Doctors" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-slate-500 hover:underline transition-all">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-xs">Emergency</h5>
          <p className="text-slate-500 mb-4">
            In case of medical emergency, please contact triple zero immediately.
          </p>
          <div className="bg-error-container text-on-error-container p-4 rounded-xl font-bold text-center">
            Call 000
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-10 border-t border-slate-100 mt-2 pt-6">
        <p className="text-slate-500 text-center md:text-left">
          © 2026 Nightingale Health Pty Ltd. In case of emergency, call 000.
        </p>
      </div>

      {/* Red emergency strip */}
      <div className="h-2 w-full bg-red-600" />
    </footer>
  );
}
