"use client";
import Link from "next/link";

type NavTab = "home" | "health" | "history" | "profile";

interface BottomNavBarProps {
  active: NavTab;
}

const tabs: { key: NavTab; icon: string; label: string; href: string }[] = [
  { key: "home", icon: "home", label: "Home", href: "/dashboard" },
  { key: "health", icon: "medical_information", label: "Health", href: "/consultation/new" },
  { key: "history", icon: "history", label: "History", href: "/history" },
  { key: "profile", icon: "person", label: "Profile", href: "/profile" },
];

export default function BottomNavBar({ active }: BottomNavBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden flex justify-around items-center px-4 pt-3 pb-6 bg-white border-t border-slate-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-2xl">
      {tabs.map(({ key, icon, label, href }) => (
        <Link
          key={key}
          href={href}
          className={`flex flex-col items-center justify-center transition-colors ${
            active === key
              ? "text-primary bg-blue-50 rounded-xl px-4 py-1"
              : "text-slate-400"
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={active === key ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {icon}
          </span>
          <span className="font-manrope text-[10px] font-bold uppercase tracking-widest mt-1">
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
