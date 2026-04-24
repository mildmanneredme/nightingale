"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

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
  const { token } = useAuth();
  const initials = token ? "U" : "?";

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-xl font-bold tracking-tighter text-primary font-manrope">
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
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold border border-slate-200">
          {initials}
        </div>
      </div>
    </header>
  );
}
