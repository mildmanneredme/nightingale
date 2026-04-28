"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { signUp, confirmSignUp, signIn, getUserRole, resendConfirmationCode } from "@/lib/auth";
import { checkEmail, registerPatient, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type Role = "patient" | "doctor";
type Step = "email" | "login" | "register" | "verify";

const PASSWORD_RULES: { id: string; label: string; test: (s: string) => boolean }[] = [
  { id: "len", label: "At least 12 characters",    test: (s) => s.length >= 12 },
  { id: "up",  label: "An uppercase letter (A–Z)", test: (s) => /[A-Z]/.test(s) },
  { id: "low", label: "A lowercase letter (a–z)",  test: (s) => /[a-z]/.test(s) },
  { id: "num", label: "A number (0–9)",             test: (s) => /\d/.test(s) },
  { id: "sym", label: "A symbol (e.g. !@#$%)",     test: (s) => /[^A-Za-z0-9]/.test(s) },
];

const PRIVACY_VERSION = "v1.0";
const RESEND_COOLDOWN_S = 60;

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { setToken } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [role, setRole] = useState<Role>("patient");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const passwordChecks = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const passwordValid = passwordChecks.every((c) => c.ok);

  function dismiss() {
    // Remove ?auth=1 from URL without a navigation entry
    const params = new URLSearchParams(window.location.search);
    params.delete("auth");
    const qs = params.toString();
    router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
    onClose();
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { exists } = await checkEmail(email);
      if (exists) {
        setStep("login");
      } else {
        if (role === "doctor") {
          // Doctor registration requires full AHPRA verification — send to dedicated page
          router.push(`/register/doctor?email=${encodeURIComponent(email)}`);
          onClose();
          return;
        }
        setStep("register");
      }
    } catch {
      // If the check fails (e.g. Cognito not configured locally) fall through to login
      setStep("login");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await signIn(email, password);
      setToken(token);
      const detectedRole = getUserRole(token);
      if (detectedRole === "patient") {
        try { await registerPatient(email, PRIVACY_VERSION); } catch (err) {
          if (!(err instanceof ApiError && err.status === 409)) throw err;
        }
      }
      onClose();
      if (detectedRole === "admin") router.replace("/admin/beta");
      else if (detectedRole === "doctor") router.replace("/doctor/queue");
      else router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!privacyAccepted) { setError("You must accept the privacy policy to continue."); return; }
    setError(null);
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
    setLoading(true);
    try {
      await confirmSignUp(email, code);
      const token = await signIn(email, password);
      setToken(token);
      await registerPatient(email, PRIVACY_VERSION);
      onClose();
      router.replace("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError(null);
    try {
      await resendConfirmationCode(email);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    }
  }

  const stepTitle: Record<Step, string> = {
    email: role === "patient" ? "Welcome back" : "Practitioner portal",
    login: "Sign in",
    register: "Create account",
    verify: "Verify your email",
  };

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) dismiss(); }}
    >
      {/* Frosted glass backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="relative z-10 w-full max-w-[440px] bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="p-8">
          {/* Patient / Doctor toggle — shown only on email step */}
          {step === "email" && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-6">
              {(["patient", "doctor"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    role === r
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {r === "patient" ? "person" : "stethoscope"}
                  </span>
                  {r === "patient" ? "Patient" : "Practitioner"}
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <h2 className="font-manrope font-bold text-2xl text-primary tracking-tight">
              {stepTitle[step]}
            </h2>
            {step === "email" && (
              <p className="text-sm text-slate-500 mt-1">
                {role === "patient"
                  ? "Enter your email to continue."
                  : "Access your practitioner dashboard."}
              </p>
            )}
            {step === "login" && (
              <p className="text-sm text-slate-500 mt-1">
                Signing in as <span className="font-semibold text-primary">{email}</span>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setPassword(""); setError(null); }}
                  className="ml-2 text-secondary hover:underline text-xs"
                >
                  Change
                </button>
              </p>
            )}
            {step === "register" && (
              <p className="text-sm text-slate-500 mt-1">
                Creating account for <span className="font-semibold text-primary">{email}</span>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setPassword(""); setError(null); }}
                  className="ml-2 text-secondary hover:underline text-xs"
                >
                  Change
                </button>
              </p>
            )}
            {step === "verify" && (
              <p className="text-sm text-slate-500 mt-1">
                Code sent to <span className="font-semibold text-primary">{email}</span>
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          {/* ── Email step ── */}
          {step === "email" && (
            <form onSubmit={handleEmailContinue} className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">mail</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Checking…" : "Continue"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          )}

          {/* ── Login step ── */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                >
                  <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
              <div className="text-right -mt-1">
                <Link href="/forgot-password" onClick={dismiss} className="text-xs text-secondary font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          )}

          {/* ── Register step ── */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                >
                  <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
              <ul className="space-y-1">
                {passwordChecks.map((c) => (
                  <li
                    key={c.id}
                    className={`flex items-center gap-2 text-[12px] font-label-sm transition-colors ${c.ok ? "text-secondary" : "text-on-surface-variant"}`}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={c.ok ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      {c.ok ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-outline-variant accent-secondary cursor-pointer shrink-0"
                />
                <span className="text-[13px] leading-snug text-on-surface">
                  I agree to the{" "}
                  <Link href="/privacy" onClick={dismiss} className="text-secondary font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                  . My data is stored in Australian data centres.
                </span>
              </label>
              <button
                type="submit"
                disabled={loading || !passwordValid || !privacyAccepted}
                className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Create Account"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          )}

          {/* ── Verify step ── */}
          {step === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">pin</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center text-2xl tracking-[0.3em] font-bold font-manrope"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying…" : "Verify Account"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-secondary font-semibold hover:underline disabled:text-on-surface-variant disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setEmail(""); setPassword(""); setCode(""); setError(null); }}
                  className="text-slate-400 hover:text-primary transition-colors text-xs"
                >
                  Use different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
