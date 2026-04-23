"use client";
import { useEffect, useState } from "react";
import { getMe, updateMe, Patient } from "@/lib/api";

export default function ProfilePage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    getMe()
      .then((p) => {
        setPatient(p);
        setFirstName(p.firstName ?? "");
        setLastName(p.lastName ?? "");
        setDateOfBirth(p.dateOfBirth ?? "");
        setPhone(p.phone ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateMe({ firstName, lastName, dateOfBirth, phone });
      setSaved(true);
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

        <div className="bg-surface-container rounded-lg p-4">
          <p className="text-label-sm text-on-surface-variant mb-1">EMAIL ADDRESS</p>
          <p className="text-body-md text-on-surface">{patient?.email}</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
