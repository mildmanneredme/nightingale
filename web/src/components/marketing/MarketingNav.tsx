"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/safety", label: "Safety" },
  { href: "/for-doctors", label: "For Doctors" },
  { href: "/about", label: "About" },
];

export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="bg-white/80 backdrop-blur-md text-slate-900 font-manrope antialiased tracking-tight sticky top-0 w-full z-50 border-b border-slate-200 shadow-sm">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" aria-label="Nightingale home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nightingale-logo.png" alt="Nightingale" className="h-9 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors ${
                pathname === href
                  ? "text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/register"
            className="bg-secondary text-white px-6 py-2.5 rounded-full font-label-sm hover:bg-secondary/90 scale-95 active:scale-90 transition-all"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 pb-6 pt-4 flex flex-col gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`px-4 py-3 rounded-xl text-base transition-colors ${
                pathname === href ? "text-slate-900 font-semibold bg-slate-50" : "text-slate-500"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="mt-4">
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-3 text-center font-semibold bg-secondary text-white rounded-full"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
