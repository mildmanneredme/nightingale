"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface-container-lowest border-b border-outline-variant h-14 flex items-center justify-between px-gutter">
        <Link href="/doctor/queue" className="font-display font-bold text-primary text-lg tracking-tight">
          Nightingale Doctor Portal
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/doctor/queue" className="text-body-md text-on-surface-variant hover:text-primary transition-colors">Queue</Link>
          <Link href="/doctor/renewals" className="text-body-md text-on-surface-variant hover:text-primary transition-colors">Renewals</Link>
          <Link href="/doctor/schedule" className="text-body-md text-on-surface-variant hover:text-primary transition-colors">Schedule</Link>
        </nav>
      </header>
      <main className="pt-14 pb-8 px-patient-margin max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  );
}
