"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp, confirmSignUp, signIn } from "@/lib/auth";
import { registerPatient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const PRIVACY_VERSION = "v1.0";

export default function RegisterPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary text-on-primary p-patient-margin">
        <div>
          <span className="font-display font-bold text-2xl tracking-tight">Nightingale</span>
        </div>
        <div>
          <h1 className="font-display text-display-xl mb-6">
            Healthcare, when you need it.
          </h1>
          <p className="text-primary-fixed-dim text-body-lg max-w-sm">
            Speak with an AI clinical assistant and get a doctor-reviewed response within hours.
          </p>
        </div>
        <div className="flex gap-4 text-primary-fixed-dim text-sm">
          <span>🔒 End-to-end encrypted</span>
          <span>🇦🇺 Australian Privacy Act</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-gutter">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-headline-lg text-on-surface mb-2">
              {step === "register" ? "Create your account" : "Verify your email"}
            </h2>
            <p className="text-on-surface-variant text-body-md">
              {step === "register"
                ? "Already have an account? "
                : "Enter the 6-digit code sent to "}
              {step === "register" ? (
                <a href="/login" className="text-secondary underline">Sign in here</a>
              ) : (
                <span className="font-semibold">{email}</span>
              )}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-md text-sm">
              {error}
            </div>
          )}

          {step === "register" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-label-sm text-on-surface-variant mb-1">
                  EMAIL ADDRESS
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-label-sm text-on-surface-variant mb-1">
                  PASSWORD
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div className="flex items-start gap-3 pt-2">
                <input
                  id="privacy"
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <label htmlFor="privacy" className="text-body-md text-on-surface-variant">
                  I have read and agree to the{" "}
                  <a href="/legal/privacy" className="text-secondary underline">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="/legal/collection-notice" className="text-secondary underline">Collection Notice</a>.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary rounded py-3 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-label-sm text-on-surface-variant mb-1">
                  VERIFICATION CODE
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary text-center text-2xl tracking-widest"
                  placeholder="123456"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary rounded py-3 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify Email"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
