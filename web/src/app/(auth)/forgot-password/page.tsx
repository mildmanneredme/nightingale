"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { forgotPassword, confirmForgotPassword } from "@/lib/auth";

type Step = "request" | "confirm";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep("confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmForgotPassword(email, code, newPassword);
      router.replace("/login?reset=1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left branding panel */}
      <div className="hidden md:flex md:w-5/12 bg-primary-container relative overflow-hidden items-center justify-center p-patient-margin">
        <div className="absolute inset-0 opacity-20 bg-medical-pattern" />
        <div className="relative z-10 max-w-md text-on-primary-fixed">
          <div className="mb-stack-lg">
            <span className="font-manrope font-bold text-[48px] leading-none tracking-tighter text-primary-fixed">
              Nightingale
            </span>
          </div>
          <h1 className="font-manrope text-headline-lg text-white mb-stack-md">
            Reset your password
          </h1>
          <p className="font-body-md text-body-lg text-primary-fixed-dim leading-relaxed">
            We'll send a 6-digit code to your email. Enter it below along with your new password.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-patient-margin bg-surface-bright">
        <div className="w-full max-w-[480px]">
          {/* Mobile branding */}
          <div className="md:hidden mb-stack-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">medical_services</span>
            <span className="font-manrope text-2xl font-bold text-primary tracking-tighter">Nightingale</span>
          </div>

          {step === "request" ? (
            <>
              <div className="mb-stack-lg">
                <h2 className="font-manrope text-headline-lg text-on-surface mb-2">Forgot password?</h2>
                <p className="font-body-md text-on-surface-variant">
                  Enter your email and we'll send you a reset code.
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-stack-md p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleRequest} className="space-y-stack-md">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send Reset Code"}
                  {!loading && <span className="material-symbols-outlined">send</span>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-stack-lg">
                <h2 className="font-manrope text-headline-lg text-on-surface mb-2">Check your email</h2>
                <p className="font-body-md text-on-surface-variant">
                  We sent a 6-digit code to <span className="font-bold text-on-surface">{email}</span>.
                  Enter it below with your new password.
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-stack-md p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirm} className="space-y-stack-md">
                <div className="space-y-2">
                  <label htmlFor="code" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                    6-Digit Code
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">pin</span>
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-outline-variant font-body-md tracking-widest"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Resetting…" : "Reset Password"}
                  {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("request"); setError(null); }}
                  className="w-full text-secondary font-manrope font-bold py-2 text-sm hover:underline"
                >
                  Send a new code
                </button>
              </form>
            </>
          )}

          <footer className="mt-stack-lg pt-stack-lg border-t border-surface-variant text-center">
            <Link href="/login" className="text-secondary font-bold text-sm hover:underline">
              Back to sign in
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
