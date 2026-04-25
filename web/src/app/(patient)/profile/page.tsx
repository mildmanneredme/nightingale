"use client";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";
import { useProfile } from "@/hooks/useProfile";

function Field({ id, label, value, onChange, type = "text", readOnly = false, note }: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-clinical-data text-label-sm text-on-surface-variant uppercase tracking-wider block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className={`w-full px-4 py-3 rounded-xl font-body-md transition-all ${
          readOnly
            ? "bg-surface-container border border-outline-variant/30 text-on-surface-variant cursor-default"
            : "bg-surface-container-lowest border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        }`}
      />
      {note && <p className="font-label-sm text-[11px] text-on-surface-variant">{note}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const {
    patient,
    loading,
    saving,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    dateOfBirth,
    setDateOfBirth,
    phone,
    setPhone,
    guardianName,
    setGuardianName,
    guardianEmail,
    setGuardianEmail,
    guardianRelationship,
    setGuardianRelationship,
    displayName,
    initials,
    handleSubmit,
    handleSignOut,
  } = useProfile();

  return (
    <>
      <TopAppBar />

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-2xl mx-auto">
        {/* Avatar header */}
        <div className="flex items-center gap-6 mb-stack-lg pb-stack-lg border-b border-outline-variant/30">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-manrope font-bold shadow-lg">
            {initials}
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">{displayName}</h1>
            <p className="font-body-md text-on-surface-variant">{patient?.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal details */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 space-y-4">
              <h2 className="font-headline-md text-headline-md text-primary">Personal Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field id="firstName" label="First Name" value={firstName} onChange={setFirstName} />
                <Field id="lastName" label="Last Name" value={lastName} onChange={setLastName} />
              </div>
              <Field id="dateOfBirth" label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} type="date" />
              <Field id="phone" label="Phone Number" value={phone} onChange={setPhone} type="tel" />
              <Field
                id="email"
                label="Email Address"
                value={patient?.email ?? ""}
                readOnly
                note="To change your email, contact support."
              />
            </div>

            {/* Guardian section (paediatric only) */}
            {patient?.isPaediatric && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-card p-6 space-y-4">
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary">Guardian / Parent</h2>
                  <p className="font-body-md text-on-surface-variant text-sm mt-1">
                    This account is registered for a minor. Keep guardian contact details current.
                  </p>
                </div>
                <Field id="guardianName" label="Guardian Name" value={guardianName} onChange={setGuardianName} />
                <Field id="guardianEmail" label="Guardian Email" value={guardianEmail} onChange={setGuardianEmail} type="email" />
                <Field
                  id="guardianRelationship"
                  label="Relationship to Patient"
                  value={guardianRelationship}
                  onChange={setGuardianRelationship}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary text-white font-manrope font-bold py-4 rounded-xl shadow-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 text-on-surface-variant font-manrope font-bold py-3 rounded-xl hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign out
            </button>
          </form>
        )}
      </main>

      <BottomNavBar active="profile" />
    </>
  );
}
