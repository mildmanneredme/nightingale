"use client";
import { useEffect, useState } from "react";
import { getMe, updateMe, Patient } from "@/lib/api";

function ReadOnlyField({ label, value, note }: { label: string; value?: string | null; note?: string }) {
  return (
    <div className="bg-surface-container rounded-lg p-4">
      <p className="text-label-sm text-on-surface-variant mb-1">{label}</p>
      <p className="text-body-md text-on-surface">{value ?? "—"}</p>
      {note && <p className="text-body-sm text-on-surface-variant mt-1">{note}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [guardianSaved, setGuardianSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  useEffect(() => {
    getMe()
      .then((p) => {
        setPatient(p);
        setFirstName(p.firstName ?? "");
        setLastName(p.lastName ?? "");
        setDateOfBirth(p.dateOfBirth ?? "");
        setPhone(p.phone ?? "");
        setGuardianName(p.guardianName ?? "");
        setGuardianEmail(p.guardianEmail ?? "");
        setGuardianRelationship(p.guardianRelationship ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setGuardianSaved(false);
    setSaving(true);
    try {
      const fields: Parameters<typeof updateMe>[0] = { firstName, lastName, dateOfBirth, phone };
      if (patient?.isPaediatric) {
        fields.guardianName = guardianName;
        fields.guardianEmail = guardianEmail;
        fields.guardianRelationship = guardianRelationship;
      }
      await updateMe(fields);
      if (patient?.isPaediatric) {
        setGuardianSaved(true);
      } else {
        setSaved(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;

  return (
    <div className="py-stack-lg max-w-2xl">
      <h1 className="font-display text-headline-lg text-on-surface mb-2">Your Profile</h1>
      <p className="text-on-surface-variant text-body-md mb-8">Keep your personal details up to date.</p>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-error-container text-on-error-container rounded-md text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 p-3 bg-secondary-container text-on-secondary-container rounded-md text-sm">
          Profile saved successfully.
        </div>
      )}
      {guardianSaved && (
        <div className="mb-4 p-3 bg-secondary-container text-on-secondary-container rounded-md text-sm">
          Guardian details updated.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-label-sm text-on-surface-variant mb-1">FIRST NAME</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-label-sm text-on-surface-variant mb-1">LAST NAME</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="dateOfBirth" className="block text-label-sm text-on-surface-variant mb-1">DATE OF BIRTH</label>
          <input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-label-sm text-on-surface-variant mb-1">PHONE NUMBER</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          />
        </div>

        <ReadOnlyField
          label="EMAIL ADDRESS"
          value={patient?.email}
          note="To change your email, contact support."
        />

        {patient?.isPaediatric && (
          <div className="border border-outline-variant rounded-xl p-5 space-y-4">
            <div>
              <p className="text-label-md font-semibold text-on-surface mb-1">Guardian / Parent Details</p>
              <p className="text-body-sm text-on-surface-variant">
                This account is registered for a minor. Keep guardian contact details current.
              </p>
            </div>

            <div>
              <label htmlFor="guardianName" className="block text-label-sm text-on-surface-variant mb-1">GUARDIAN NAME</label>
              <input
                id="guardianName"
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="guardianEmail" className="block text-label-sm text-on-surface-variant mb-1">GUARDIAN EMAIL</label>
              <input
                id="guardianEmail"
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="guardianRelationship" className="block text-label-sm text-on-surface-variant mb-1">RELATIONSHIP TO PATIENT</label>
              <input
                id="guardianRelationship"
                type="text"
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
                placeholder="e.g. Mother, Father, Carer"
                className="w-full border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
