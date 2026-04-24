"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top app bar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface-container-lowest border-b border-outline-variant h-14 flex items-center px-gutter">
        <Link href="/dashboard" className="font-display font-bold text-primary text-lg tracking-tight">
          Nightingale
        </Link>
      </header>

      {/* Page content */}
      <main className="pt-14 pb-20 px-patient-margin max-w-5xl mx-auto">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-surface-container-lowest border-t border-outline-variant h-16 flex items-center justify-around px-4 md:hidden">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-2xl">home</span>
          Home
        </Link>
        <Link href="/inbox" className="flex flex-col items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-2xl">inbox</span>
          Inbox
        </Link>
        <Link href="/history" className="flex flex-col items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-2xl">history</span>
          History
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-2xl">person</span>
          Profile
        </Link>
      </nav>
    </div>
  );
}
