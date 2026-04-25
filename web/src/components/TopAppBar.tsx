"use client";
import Link from "next/link";

type NavItem = "health" | "appointments" | "records";

interface TopAppBarProps {
  activeNav?: NavItem;
}

const navLinks: { key: NavItem; label: string; href: string }[] = [
  { key: "health", label: "My Health", href: "/dashboard" },
  { key: "appointments", label: "Appointments", href: "/consultation/new" },
  { key: "records", label: "Records", href: "/history" },
];

export default function TopAppBar({ activeNav }: TopAppBarProps) {

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-xl font-bold tracking-tighter text-slate-900 font-manrope">
          Nightingale
        </Link>
        <nav className="hidden md:flex gap-6 items-center">
          {navLinks.map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className={`font-manrope text-sm font-medium tracking-tight transition-colors pb-1 ${
                activeNav === key
                  ? "text-primary border-b-2 border-primary"
                  : "text-slate-500 hover:text-primary"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white hover:opacity-80 transition-opacity"
          aria-label="Your profile"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        </Link>
      </div>
    </header>
  );
}
