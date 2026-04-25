"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getUserRole } from "@/lib/auth";
import { registerPatient, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function PasswordResetBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("reset") !== "1") return null;
  return (
    <div className="mb-stack-md p-4 bg-secondary-container text-on-secondary-container rounded-xl text-sm flex items-center gap-2">
      <span className="material-symbols-outlined text-base">check_circle</span>
      Password reset successfully. Please sign in.
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await signIn(email, password);
      setToken(token);
      const role = getUserRole(token);
      if (role === "patient") {
        // Ensure a patient record exists — idempotent, 409 means it's already there
        try {
          await registerPatient(email, "v1.0");
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 409)) throw err;
        }
      }
      if (role === "admin") router.replace("/admin/beta");
      else if (role === "doctor") router.replace("/doctor/queue");
      else router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left: Branding panel */}
      <div
        className="hidden md:flex md:w-5/12 relative overflow-hidden items-center justify-center p-patient-margin"
        style={{ backgroundImage: "url('/landing-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="relative z-10 max-w-md text-on-primary-fixed">
          <div className="mb-stack-lg">
            <span className="font-manrope font-bold text-[48px] leading-none tracking-tighter text-primary-fixed">
              Nightingale
            </span>
          </div>
          <h1 className="font-manrope text-headline-lg text-white mb-stack-md">
            Your health journey, unified and secure.
          </h1>
          <p className="font-body-md text-body-lg text-primary-fixed-dim leading-relaxed mb-stack-lg">
            Join thousands of Australians managing their healthcare with digital bedside manner. Secure, clinical, and always focused on you.
          </p>
          <div className="space-y-stack-md">
            <div className="flex items-center gap-4 text-white">
              <span className="material-symbols-outlined text-secondary-fixed">verified_user</span>
              <span className="font-clinical-data text-clinical-data">Australian Privacy Act Compliant</span>
            </div>
            <div className="flex items-center gap-4 text-white">
              <span className="material-symbols-outlined text-secondary-fixed">encrypted</span>
              <span className="font-clinical-data text-clinical-data">End-to-End Clinical Encryption</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-patient-margin bg-surface-bright">
        <div className="w-full max-w-[480px]">
          {/* Mobile branding */}
          <div className="md:hidden mb-stack-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">medical_services</span>
            <span className="font-manrope text-2xl font-bold text-primary tracking-tighter">Nightingale</span>
          </div>

          <div className="mb-stack-lg">
            <h2 className="font-manrope text-headline-lg text-on-surface mb-2">Welcome back</h2>
            <p className="font-body-md text-on-surface-variant">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline">
                Register here
              </Link>
            </p>
          </div>

          <Suspense>
            <PasswordResetBanner />
          </Suspense>

          {error && (
            <div role="alert" className="mb-stack-md p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-stack-md">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">mail</span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jamie.citizen@outlook.com.au"
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-outline-variant font-body-md"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full pl-12 pr-12 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-outline-variant font-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-secondary font-bold hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
              {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
          </form>

          {/* Footer */}
          <footer className="mt-stack-lg pt-stack-lg border-t border-surface-variant flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-clinical-data text-[12px] text-outline uppercase tracking-widest">
              Proudly Australian Owned
            </span>
            <div className="flex gap-4">
              <Link href="#" className="text-outline text-label-sm hover:text-on-surface">Support</Link>
              <Link href="/legal/privacy" className="text-outline text-label-sm hover:text-on-surface">Legal</Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
