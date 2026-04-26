"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signUp,
  confirmSignUp,
  signIn,
  resendConfirmationCode,
} from "@/lib/auth";
import { registerPatient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const PRIVACY_VERSION = "v1.0";

// UX-005 F-006: live password requirements (mirror Cognito user-pool policy
// in infra/terraform/modules/cognito/main.tf — keep these two in sync).
const PASSWORD_RULES: { id: string; label: string; test: (s: string) => boolean }[] = [
  { id: "len",  label: "At least 12 characters",       test: (s) => s.length >= 12 },
  { id: "up",   label: "An uppercase letter (A–Z)",    test: (s) => /[A-Z]/.test(s) },
  { id: "low",  label: "A lowercase letter (a–z)",     test: (s) => /[a-z]/.test(s) },
  { id: "num",  label: "A number (0–9)",                test: (s) => /\d/.test(s) },
  { id: "sym",  label: "A symbol (e.g. !@#$%)",         test: (s) => /[^A-Za-z0-9]/.test(s) },
];

const RESEND_COOLDOWN_S = 60;

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
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Resend cooldown — counts down once per second after a successful resend
  // or after Cognito's initial code email at sign-up.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const passwordChecks = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const passwordValid = passwordChecks.every((c) => c.ok);
  const canSubmitRegister = !loading && privacyAccepted && passwordValid && email.length > 0;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!privacyAccepted) {
      setError("You must accept the privacy policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setStep("verify");
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      const token = await signIn(email, password);
      setToken(token);
      await registerPatient(email, PRIVACY_VERSION);
      // PRD-023: route to the onboarding wizard before the dashboard so we
      // capture identity, address/Medicare/GP, and a clinical baseline.
      router.replace("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  // UX-005 F-001/F-003: resend with cooldown + inline confirmation
  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError(null);
    setInfo(null);
    try {
      await resendConfirmationCode(email);
      setCooldown(RESEND_COOLDOWN_S);
      setInfo("A new code has been sent. Check your inbox (and spam folder).");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    }
  }

  // UX-005 F-004/F-005: replace the misleading Back button. Returning to step
  // 1 with the same email + password risks a UsernameExistsException loop.
  // Clearing the form here lets the user sign up with a different email
  // cleanly. The half-created Cognito account becomes orphaned until its
  // unverified-account TTL expires (Cognito default: 7 days) — acceptable
  // and documented in PRD UX-005.
  function handleUseDifferentEmail() {
    setStep("register");
    setEmail("");
    setPassword("");
    setCode("");
    setError(null);
    setInfo("Start with a different email below. The unverified account from your previous attempt will expire automatically.");
    setCooldown(0);
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
            AHPRA-registered Australian doctors review every consultation. Hosted in Australia, end-to-end encrypted.
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
          {info && (
            <div role="status" className="mb-stack-md p-4 bg-secondary-container/40 text-on-secondary-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {info}
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
                    placeholder="Min. 12 characters with upper, lower, number, symbol"
                    aria-describedby="password-checklist"
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
                {/* UX-005 F-006: live requirements checklist */}
                <ul id="password-checklist" className="space-y-1 pt-2">
                  {passwordChecks.map((c) => (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 text-[12px] font-label-sm transition-colors ${
                        c.ok ? "text-secondary" : "text-on-surface-variant"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={c.ok ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {c.ok ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
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
                      <Link href="/privacy" className="text-secondary font-bold hover:underline">Privacy Policy</Link>
                      {" "}(which includes our collection notice).
                      {" "}I understand my data is stored in Australian data centres.
                    </span>
                  </label>
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={!canSubmitRegister}
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
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
                disabled={loading || code.length !== 6}
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying…" : "Verify Account"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>

              {/* UX-005 F-001/F-002: resend with cooldown */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-secondary font-bold hover:underline disabled:text-on-surface-variant disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <footer className="mt-stack-lg pt-stack-lg border-t border-surface-variant flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-clinical-data text-[12px] text-outline uppercase tracking-widest">
              Proudly Australian Owned
            </span>
            <div className="flex gap-4">
              <Link href="/faq" className="text-outline text-label-sm hover:text-on-surface">Support</Link>
              <Link href="/privacy" className="text-outline text-label-sm hover:text-on-surface">Legal</Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
