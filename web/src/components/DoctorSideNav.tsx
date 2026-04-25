"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { signOut as authSignOut } from "@/lib/auth";

type NavItem = "hub" | "queue" | "schedule" | "analytics" | "settings";

interface DoctorSideNavProps {
  active: NavItem;
  doctorName?: string;
}

const navItems: { key: NavItem; icon: string; label: string; href: string }[] = [
  { key: "hub", icon: "dashboard", label: "Clinical Hub", href: "/doctor/queue" },
  { key: "queue", icon: "group", label: "Patient Queue", href: "/doctor/queue" },
  { key: "schedule", icon: "calendar_month", label: "Schedule", href: "/doctor/schedule" },
  { key: "analytics", icon: "monitoring", label: "Analytics", href: "/doctor/queue" },
  { key: "settings", icon: "settings", label: "Settings", href: "/doctor/queue" },
];

export default function DoctorSideNav({ active, doctorName = "Dr. Nightingale" }: DoctorSideNavProps) {
  const router = useRouter();
  const { setToken } = useAuth();

  function handleSignOut() {
    authSignOut();
    setToken(null);
    router.replace("/login");
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 border-r border-slate-200 sticky left-0 top-0 py-6 space-y-4 bg-slate-50 shrink-0">
      <div className="px-6 mb-2">
        <h1 className="font-black text-primary text-lg uppercase tracking-tighter font-manrope">
          Nightingale
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-sm">
            <span className="material-symbols-outlined text-white text-lg">stethoscope</span>
          </div>
          <div>
            <p className="font-manrope text-sm font-bold text-primary leading-tight">{doctorName}</p>
            <p className="font-manrope text-[11px] text-slate-500 uppercase font-semibold">General Practitioner</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ key, icon, label, href }) =>
          active === key ? (
            <Link
              key={key}
              href={href}
              className="flex items-center gap-3 bg-primary text-white rounded-lg mx-2 px-4 py-2 font-semibold font-manrope text-sm"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              {label}
            </Link>
          ) : (
            <Link
              key={key}
              href={href}
              className="flex items-center gap-3 text-on-surface-variant mx-2 px-4 py-2 rounded-lg font-manrope text-sm hover:bg-surface-container hover:translate-x-1 transition-all"
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </Link>
          )
        )}
      </nav>

      <div className="px-4 mt-auto space-y-2">
        <Link
          href="/doctor/consultation/new"
          className="w-full bg-secondary text-white py-3 rounded-xl font-bold font-manrope text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Start Consultation
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full text-slate-500 py-2 rounded-lg font-manrope text-xs hover:text-on-surface transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
