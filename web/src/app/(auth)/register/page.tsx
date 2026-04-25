"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, confirmSignUp, signIn } from "@/lib/auth";
import { registerPatient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const PRIVACY_VERSION = "v1.0";

export default function RegisterPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [step, setStep] = useState<"register" | "verify">("register");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!privacyAccepted) {
      setError("You must accept the privacy policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setStep("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      const token = await signIn(email, password);
      setToken(token);
      await registerPatient(email, PRIVACY_VERSION);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left: Branding panel */}
      <div className="hidden md:flex md:w-5/12 bg-primary-container relative overflow-hidden items-center justify-center p-patient-margin">
        <div className="absolute inset-0 opacity-20 bg-medical-pattern" />
        <div className="relative z-10 max-w-md text-on-primary-fixed">
          <div className="mb-stack-lg">
            <span className="font-display-xl text-display-xl text-primary-fixed">
              Nightingale
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-white mb-stack-md">
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

      {/* Right: Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-patient-margin bg-surface-bright">
        <div className="w-full max-w-[480px]">
          {/* Mobile branding */}
          <div className="md:hidden mb-stack-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">medical_services</span>
            <span className="font-manrope text-2xl font-bold text-primary tracking-tighter">Nightingale</span>
          </div>

          <div className="mb-stack-lg">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              {step === "register" ? "Create Patient Account" : "Verify your email"}
            </h2>
            <p className="font-body-md text-on-surface-variant">
              {step === "register" ? (
                <>
                  Access your Australian clinical records securely.{" "}
                  <Link href="/login" className="text-primary font-bold hover:underline">Sign in here</Link>
                </>
              ) : (
                <>
                  Enter the 6-digit code sent to{" "}
                  <span className="font-semibold text-primary">{email}</span>
                </>
              )}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-stack-md p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          {step === "register" ? (
            <form onSubmit={handleRegister} className="space-y-stack-md">
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
                  Secure Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 12 characters"
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
                <p className="font-label-sm text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Use symbols for medical-grade security.
                </p>
              </div>

              {/* Privacy consent */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-variant">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1 h-5 w-5 bg-secondary/10 flex items-center justify-center rounded-full">
                    <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      id="privacy"
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-outline-variant accent-secondary cursor-pointer"
                    />
                    <span className="font-body-md text-[14px] leading-snug text-on-surface">
                      I agree to the{" "}
                      <Link href="/legal/privacy" className="text-secondary font-bold hover:underline">Privacy Policy</Link>
                      {" "}and{" "}
                      <Link href="/legal/collection-notice" className="text-secondary font-bold hover:underline">Collection Notice</Link>.
                      {" "}I understand my data is stored in Australian data centres.
                    </span>
                  </label>
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create Account"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-stack-md">
              <div className="space-y-2">
                <label htmlFor="code" className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                  Verification Code
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">pin</span>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center text-2xl tracking-[0.3em] font-bold font-manrope"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify Account"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>

              <button
                type="button"
                onClick={() => { setStep("register"); setError(null); }}
                className="w-full text-on-surface-variant text-sm hover:text-primary transition-colors"
              >
                ← Back
              </button>
            </form>
          )}

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
