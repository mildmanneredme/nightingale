"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  updateMe,
  addAllergy,
  addMedication,
  addCondition,
  recordOnboardingStep,
  ApiError,
} from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

// PRD-023 wizard. Three steps post-verify, pre-dashboard. Each step's
// "Skip for now" advances and records the skip; required-field skips
// surface a soft warning but do not block.

type Step = 0 | 1 | 2 | 3; // 0 = welcome screen, 1–3 = wizard steps

interface FormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  preferredName: string;
  phone: string;
  address: string;
  medicareNumber: string;
  gpName: string;
  gpClinic: string;
  allergies: string;
  allergiesNoneDeclared: boolean;
  medications: string;
  medicationsNoneDeclared: boolean;
  conditions: string;
  conditionsNoneDeclared: boolean;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  preferredName: "",
  phone: "",
  address: "",
  medicareNumber: "",
  gpName: "",
  gpClinic: "",
  allergies: "",
  allergiesNoneDeclared: false,
  medications: "",
  medicationsNoneDeclared: false,
  conditions: "",
  conditionsNoneDeclared: false,
};

const REQUIRED_BY_STEP: Record<1 | 2 | 3, (keyof FormState)[]> = {
  1: ["firstName", "lastName", "dateOfBirth", "phone"],
  2: ["address"],
  3: [], // baseline can always be skipped — soft warning shown instead
};

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // If the user is already onboarded, send them straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((p) => {
        if (cancelled) return;
        if (p.onboardingCompletedAt) {
          router.replace("/dashboard");
          return;
        }
        // Pre-fill any fields the patient already has on file (e.g. they came
        // back to finish onboarding after partially completing it earlier).
        setForm((prev) => ({
          ...prev,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          preferredName: p.preferredName ?? "",
          dateOfBirth: p.dateOfBirth ?? "",
          phone: p.phone ?? "",
          address: p.address ?? "",
          medicareNumber: p.medicareNumber ?? "",
          gpName: p.gpName ?? "",
          gpClinic: p.gpClinic ?? "",
          allergiesNoneDeclared: p.allergiesNoneDeclared ?? false,
          medicationsNoneDeclared: p.medicationsNoneDeclared ?? false,
          conditionsNoneDeclared: p.conditionsNoneDeclared ?? false,
        }));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [router]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function missingRequiredFields(currentStep: 1 | 2 | 3): string[] {
    return REQUIRED_BY_STEP[currentStep].filter((k) => !String(form[k]).trim());
  }

  async function persistStep1() {
    await updateMe({
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      preferredName: form.preferredName.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      phone: form.phone.trim() || undefined,
    });
  }

  async function persistStep2() {
    const fields: Parameters<typeof updateMe>[0] = {};
    if (form.address.trim()) fields.address = form.address.trim();
    if (form.medicareNumber.trim()) fields.medicareNumber = form.medicareNumber.trim();
    if (form.gpName.trim()) fields.gpName = form.gpName.trim();
    if (form.gpClinic.trim()) fields.gpClinic = form.gpClinic.trim();
    if (Object.keys(fields).length > 0) await updateMe(fields);
  }

  async function persistStep3() {
    // Save the "none declared" flags and any free-text entries. We only create
    // one record per category here — the patient can add detail later via
    // the profile page.
    await updateMe({
      allergiesNoneDeclared: form.allergiesNoneDeclared,
      medicationsNoneDeclared: form.medicationsNoneDeclared,
      conditionsNoneDeclared: form.conditionsNoneDeclared,
    });
    if (form.allergies.trim() && !form.allergiesNoneDeclared) {
      await addAllergy(form.allergies.trim(), "moderate");
    }
    if (form.medications.trim() && !form.medicationsNoneDeclared) {
      await addMedication(form.medications.trim());
    }
    if (form.conditions.trim() && !form.conditionsNoneDeclared) {
      await addCondition(form.conditions.trim());
    }
  }

  async function handleNext(currentStep: 1 | 2 | 3, skipped = false) {
    setSaving(true);
    try {
      const skippedFields = skipped ? missingRequiredFields(currentStep) : [];
      if (!skipped) {
        if (currentStep === 1) await persistStep1();
        else if (currentStep === 2) await persistStep2();
        else await persistStep3();
      }
      await recordOnboardingStep(currentStep, skipped, skippedFields);
      if (currentStep < 3) setStep((currentStep + 1) as Step);
      else router.replace("/dashboard?welcome=1");
    } catch (err: unknown) {
      const { title, detail } =
        err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, {
        detail,
        correlationId: err instanceof ApiError ? err.correlationId : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bright">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col">
      {/* Top bar — minimal, no navigation */}
      <header className="px-6 py-5 border-b border-outline-variant/30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-manrope font-bold text-xl tracking-tighter text-primary">
            Nightingale
          </span>
          {step > 0 && (
            <span className="font-clinical-data text-xs text-on-surface-variant uppercase tracking-widest">
              Step {step} of 3
            </span>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {step > 0 && (
        <div className="px-6 pt-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    n <= step ? "bg-secondary" : "bg-outline-variant/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {step === 0 && <Welcome onStart={() => setStep(1)} />}
          {step === 1 && (
            <Step1
              form={form}
              set={set}
              saving={saving}
              missing={missingRequiredFields(1)}
              onNext={() => handleNext(1, false)}
              onSkip={() => handleNext(1, true)}
            />
          )}
          {step === 2 && (
            <Step2
              form={form}
              set={set}
              saving={saving}
              missing={missingRequiredFields(2)}
              onBack={() => setStep(1)}
              onNext={() => handleNext(2, false)}
              onSkip={() => handleNext(2, true)}
            />
          )}
          {step === 3 && (
            <Step3
              form={form}
              set={set}
              saving={saving}
              onBack={() => setStep(2)}
              onFinish={() => handleNext(3, false)}
              onSkip={() => handleNext(3, true)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12 space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-secondary-container flex items-center justify-center">
        <span
          className="material-symbols-outlined text-secondary text-4xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          waving_hand
        </span>
      </div>
      <h1 className="font-headline-lg text-headline-lg text-primary">
        Welcome to Nightingale
      </h1>
      <p className="font-body-lg text-on-surface-variant max-w-md mx-auto">
        We&apos;ll ask a few quick questions so doctors and our AI assistant have what
        they need to help you. Most patients finish in under three minutes.
      </p>
      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
        {[
          { icon: "badge", title: "Who you are", body: "Name, date of birth, contact" },
          { icon: "location_on", title: "Where to reach you", body: "Address, Medicare, your GP" },
          { icon: "medical_information", title: "Your health basics", body: "Allergies, medications, conditions" },
        ].map((s) => (
          <div key={s.title} className="bg-white border border-outline-variant/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2 text-secondary">
              <span className="material-symbols-outlined">{s.icon}</span>
              <span className="font-manrope font-bold text-primary">{s.title}</span>
            </div>
            <p className="font-body-md text-on-surface-variant text-sm">{s.body}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onStart}
        className="mt-8 bg-primary text-white font-manrope font-bold px-8 py-4 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
      >
        Get started
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form primitives
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md"
      />
      {hint && <p className="font-label-sm text-[11px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}

function StepHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-headline-lg text-headline-lg text-primary mb-2">{title}</h2>
      <p className="font-body-md text-on-surface-variant">{body}</p>
    </div>
  );
}

function StepFooter({
  saving,
  onBack,
  onSkip,
  onNext,
  nextLabel,
  missing,
}: {
  saving: boolean;
  onBack?: () => void;
  onSkip: () => void;
  onNext: () => void;
  nextLabel: string;
  missing: string[];
}) {
  return (
    <div className="mt-8 space-y-3">
      {missing.length > 0 && (
        <div className="rounded-xl bg-tertiary-container/40 border border-tertiary/30 px-4 py-3 text-sm text-on-tertiary-container">
          <strong>Skipping required fields:</strong> {missing.join(", ")}.
          Doctors need these to review your consultation safely. You can come back later from your profile.
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="text-on-surface-variant font-manrope font-bold px-4 py-3 rounded-xl hover:bg-surface-container disabled:opacity-50"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-on-surface-variant font-manrope font-bold px-4 py-3 rounded-xl hover:bg-surface-container disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={saving}
            className="bg-primary text-white font-manrope font-bold px-6 py-3 rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : nextLabel}
            {!saving && <span className="material-symbols-outlined text-base">arrow_forward</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Identity
// ---------------------------------------------------------------------------

function Step1({
  form,
  set,
  saving,
  missing,
  onNext,
  onSkip,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  saving: boolean;
  missing: string[];
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <StepHeader title="Tell us about you" body="The basics so we can address you correctly and reach you if needed." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field id="firstName" label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} required />
          <Field id="lastName" label="Last name" value={form.lastName} onChange={(v) => set("lastName", v)} required />
        </div>
        <Field id="preferredName" label="Preferred name (optional)" value={form.preferredName} onChange={(v) => set("preferredName", v)} placeholder="What you'd like the doctor to call you" />
        <Field id="dateOfBirth" label="Date of birth" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} type="date" required />
        <Field id="phone" label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} type="tel" placeholder="04xx xxx xxx" required />
      </div>
      <StepFooter saving={saving} onSkip={onSkip} onNext={onNext} nextLabel="Continue" missing={missing} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Address & Healthcare
// ---------------------------------------------------------------------------

function Step2({
  form,
  set,
  saving,
  missing,
  onBack,
  onNext,
  onSkip,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  saving: boolean;
  missing: string[];
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <StepHeader title="Address & healthcare" body="Helps us route prescriptions and refer you locally if needed." />
      <div className="space-y-4">
        <Field id="address" label="Address" value={form.address} onChange={(v) => set("address", v)} placeholder="Street, suburb, state, postcode" required />
        <Field
          id="medicareNumber"
          label="Medicare number (optional)"
          value={form.medicareNumber}
          onChange={(v) => set("medicareNumber", v.replace(/\D/g, "").slice(0, 11))}
          placeholder="10 or 11 digits"
          hint="We don't bulk-bill yet, but we'll attach this to your record for continuity of care."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="gpName" label="Your usual GP (optional)" value={form.gpName} onChange={(v) => set("gpName", v)} placeholder="Dr Jane Smith" />
          <Field id="gpClinic" label="Clinic name (optional)" value={form.gpClinic} onChange={(v) => set("gpClinic", v)} placeholder="Bondi Junction Medical" />
        </div>
      </div>
      <StepFooter saving={saving} onBack={onBack} onSkip={onSkip} onNext={onNext} nextLabel="Continue" missing={missing} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Clinical baseline
// ---------------------------------------------------------------------------

function Step3({
  form,
  set,
  saving,
  onBack,
  onFinish,
  onSkip,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <StepHeader title="Your health basics" body="Even a quick answer helps the AI assistant skip obvious questions and helps the doctor approve your consultation faster." />
      <div className="space-y-6">
        <BaselineCategory
          id="allergies"
          title="Known allergies"
          placeholder="e.g. Penicillin, latex, peanuts"
          value={form.allergies}
          onValue={(v) => set("allergies", v)}
          none={form.allergiesNoneDeclared}
          onNone={(b) => set("allergiesNoneDeclared", b)}
          noneLabel="No known allergies"
        />
        <BaselineCategory
          id="medications"
          title="Current medications"
          placeholder="e.g. Ventolin 100mcg as needed, Sertraline 50mg daily"
          value={form.medications}
          onValue={(v) => set("medications", v)}
          none={form.medicationsNoneDeclared}
          onNone={(b) => set("medicationsNoneDeclared", b)}
          noneLabel="Not taking any regular medications"
        />
        <BaselineCategory
          id="conditions"
          title="Known conditions"
          placeholder="e.g. Asthma, type 2 diabetes, anxiety"
          value={form.conditions}
          onValue={(v) => set("conditions", v)}
          none={form.conditionsNoneDeclared}
          onNone={(b) => set("conditionsNoneDeclared", b)}
          noneLabel="No diagnosed conditions"
        />
      </div>
      <StepFooter saving={saving} onBack={onBack} onSkip={onSkip} onNext={onFinish} nextLabel="Finish" missing={[]} />
    </>
  );
}

function BaselineCategory({
  id,
  title,
  placeholder,
  value,
  onValue,
  none,
  onNone,
  noneLabel,
}: {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  onValue: (v: string) => void;
  none: boolean;
  onNone: (b: boolean) => void;
  noneLabel: string;
}) {
  return (
    <div className="bg-white border border-outline-variant/30 rounded-xl p-5 space-y-3">
      <h3 className="font-manrope font-bold text-primary">{title}</h3>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          onValue(e.target.value);
          if (e.target.value.trim() && none) onNone(false);
        }}
        rows={2}
        disabled={none}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md resize-none disabled:opacity-50 disabled:bg-surface-container"
      />
      <label className="flex items-center gap-2 cursor-pointer text-sm text-on-surface">
        <input
          type="checkbox"
          checked={none}
          onChange={(e) => {
            onNone(e.target.checked);
            if (e.target.checked) onValue("");
          }}
          className="w-4 h-4 rounded border-outline-variant accent-secondary cursor-pointer"
        />
        {noneLabel}
      </label>
    </div>
  );
}
