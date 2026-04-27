"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signUpDoctor,
  confirmSignUp,
  signIn,
  resendConfirmationCode,
} from "@/lib/auth";
import { registerDoctor } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const SPECIALTIES = [
  { value: "GP-FRACGP",        label: "GP — FRACGP" },
  { value: "GP-FACRRM",        label: "GP — FACRRM (Rural & Remote)" },
  { value: "GP-non-vocational", label: "GP — Non-vocational" },
  { value: "Specialist-other", label: "Specialist (other)" },
  { value: "Other",            label: "Other" },
] as const;

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

const HOURS = [
  { value: "0-10",  label: "0–10 hrs / week" },
  { value: "10-20", label: "10–20 hrs / week" },
  { value: "20+",   label: "20+ hrs / week" },
] as const;

const PASSWORD_RULES: { id: string; label: string; test: (s: string) => boolean }[] = [
  { id: "len", label: "At least 12 characters",     test: (s) => s.length >= 12 },
  { id: "up",  label: "An uppercase letter (A–Z)",  test: (s) => /[A-Z]/.test(s) },
  { id: "low", label: "A lowercase letter (a–z)",   test: (s) => /[a-z]/.test(s) },
  { id: "num", label: "A number (0–9)",              test: (s) => /\d/.test(s) },
  { id: "sym", label: "A symbol (e.g. !@#$%)",      test: (s) => /[^A-Za-z0-9]/.test(s) },
];

const RESEND_COOLDOWN_S = 60;

type Step = "register" | "verify";

export default function DoctorRegisterPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  // Account fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Clinical fields
  const [fullName, setFullName]         = useState("");
  const [ahpraNumber, setAhpraNumber]   = useState("");
  const [mobile, setMobile]             = useState("");
  const [specialty, setSpecialty]       = useState<string>(SPECIALTIES[0].value);
  const [primaryState, setPrimaryState] = useState<string>(STATES[0]);
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(HOURS[0].value);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [step, setStep]     = useState<Step>("register");
  const [code, setCode]     = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [info, setInfo]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const passwordChecks = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const passwordValid  = passwordChecks.every((c) => c.ok);
  const ahpraValid     = /^[A-Za-z]{3}\d{10}$/.test(ahpraNumber);
  const mobileValid    = /^\+61[0-9]{9}$/.test(mobile);

  const canSubmit =
    !loading &&
    privacyAccepted &&
    passwordValid &&
    email.length > 0 &&
    fullName.trim().length >= 2 &&
    ahpraValid &&
    mobileValid;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signUpDoctor(email, password);
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
      await registerDoctor({
        fullName: fullName.trim(),
        ahpraNumber: ahpraNumber.toUpperCase(),
        mobile,
        specialty,
        primaryState,
        hoursPerWeek,
      });
      router.replace("/doctor/queue");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

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

  function handleUseDifferentEmail() {
    setStep("register");
    setEmail("");
    setPassword("");
    setCode("");
    setError(null);
    setInfo("Start with a different email. The unverified account from your previous attempt will expire automatically.");
    setCooldown(0);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left: Branding */}
      <div className="hidden md:flex md:w-5/12 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="relative z-10 max-w-md">
          <div className="mb-8">
            <span className="font-display-xl text-display-xl text-white">Nightingale</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-white mb-6">
            Join Australia&rsquo;s doctor-in-the-loop telehealth platform.
          </h1>
          <p className="text-white/80 mb-8 leading-relaxed">
            Review AI-structured consultations at your own pace. $15 per consultation, AHPRA-registered practitioners only.
          </p>
          <div className="space-y-4">
            {[
              { icon: "schedule", text: "2–5 minutes per review" },
              { icon: "payments", text: "$15 per consultation" },
              { icon: "verified", text: "AHPRA verification required" },
            ].map(({ icon, text }) => (
              <div key={icon} className="flex items-center gap-3 text-white">
                <span className="material-symbols-outlined text-white/60">{icon}</span>
                <span className="font-clinical-data">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-start justify-center px-6 py-12 bg-surface-bright overflow-y-auto">
        <div className="w-full max-w-[520px]">
          <div className="md:hidden mb-8 flex items-center gap-2">
            <span className="font-manrope text-2xl font-bold text-primary tracking-tighter">Nightingale</span>
          </div>

          <div className="mb-8">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              {step === "register" ? "Apply to Practice" : "Verify your email"}
            </h2>
            <p className="font-body-md text-on-surface-variant">
              {step === "register" ? (
                <>Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link></>
              ) : (
                <>Enter the 6-digit code sent to <span className="font-semibold text-primary">{email}</span></>
              )}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
          {info && (
            <div role="status" className="mb-6 p-4 bg-secondary-container/40 text-on-secondary-container rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {info}
            </div>
          )}

          {step === "register" ? (
            <form onSubmit={handleRegister} className="space-y-5">
              {/* Full name */}
              <Field label="Full Name (as registered with AHPRA)" icon="badge">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className={INPUT}
                />
              </Field>

              {/* Email */}
              <Field label="Email Address" icon="mail">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.smith@clinic.com.au"
                  className={INPUT}
                />
              </Field>

              {/* Password */}
              <div className="space-y-2">
                <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 12 characters"
                    className={`${INPUT} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                  >
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                <ul className="space-y-1 pt-1">
                  {passwordChecks.map((c) => (
                    <li key={c.id} className={`flex items-center gap-2 text-[12px] transition-colors ${c.ok ? "text-secondary" : "text-on-surface-variant"}`}>
                      <span className="material-symbols-outlined text-[16px]" style={c.ok ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                        {c.ok ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AHPRA */}
              <Field label="AHPRA Number" icon="badge" hint={!ahpraValid && ahpraNumber.length > 0 ? "3 letters + 10 digits (e.g. MED1234567890)" : undefined}>
                <input
                  type="text"
                  required
                  value={ahpraNumber}
                  onChange={(e) => setAhpraNumber(e.target.value.toUpperCase())}
                  placeholder="MED1234567890"
                  maxLength={13}
                  className={`${INPUT} ${!ahpraValid && ahpraNumber.length > 0 ? "border-error" : ""}`}
                />
              </Field>

              {/* Mobile */}
              <Field label="Mobile (Australian)" icon="phone" hint={!mobileValid && mobile.length > 0 ? "+61 format required (e.g. +61412345678)" : undefined}>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+61412345678"
                  className={`${INPUT} ${!mobileValid && mobile.length > 0 ? "border-error" : ""}`}
                />
              </Field>

              {/* Specialty */}
              <div className="space-y-2">
                <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">Specialty</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* State + Hours — 2-col */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">Primary State</label>
                  <select
                    value={primaryState}
                    onChange={(e) => setPrimaryState(e.target.value)}
                    className="w-full px-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                  >
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">Capacity</label>
                  <select
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    className="w-full px-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
                  >
                    {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Privacy */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-surface-variant">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-outline-variant accent-primary cursor-pointer"
                  />
                  <span className="font-body-md text-[14px] leading-snug text-on-surface">
                    I agree to the{" "}
                    <Link href="/privacy" className="text-primary font-bold hover:underline">Privacy Policy</Link>
                    {" "}and practitioner terms. I confirm I hold current AHPRA registration.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Submit Application"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-2">
                <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
                  Verification Code
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">pin</span>
                  <input
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
                className="w-full bg-primary hover:bg-primary-container text-white font-manrope font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying…" : "Verify & Submit"}
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>

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
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full pl-12 pr-4 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-outline-variant font-body-md";

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">{icon}</span>
        {children}
      </div>
      {hint && <p className="text-[11px] text-error ml-1">{hint}</p>}
    </div>
  );
}
