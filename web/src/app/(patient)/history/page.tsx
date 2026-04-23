"use client";
import { useEffect, useState } from "react";
import {
  getMe, addAllergy, deleteAllergy, addMedication, deleteMedication, addCondition, deleteCondition,
  Patient,
} from "@/lib/api";

export default function HistoryPage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [allergyInput, setAllergyInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");

  async function refresh() {
    const p = await getMe();
    setPatient(p);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAddAllergy(e: React.FormEvent) {
    e.preventDefault();
    if (!allergyInput.trim()) return;
    await addAllergy(allergyInput.trim(), "mild");
    setAllergyInput("");
    await refresh();
  }

  async function handleDeleteAllergy(id: string) {
    await deleteAllergy(id);
    await refresh();
  }

  async function handleAddMedication(e: React.FormEvent) {
    e.preventDefault();
    if (!medInput.trim()) return;
    await addMedication(medInput.trim());
    setMedInput("");
    await refresh();
  }

  async function handleDeleteMedication(id: string) {
    await deleteMedication(id);
    await refresh();
  }

  async function handleAddCondition(e: React.FormEvent) {
    e.preventDefault();
    if (!conditionInput.trim()) return;
    await addCondition(conditionInput.trim());
    setConditionInput("");
    await refresh();
  }

  async function handleDeleteCondition(id: string) {
    await deleteCondition(id);
    await refresh();
  }

  if (loading) return <div className="py-stack-lg text-on-surface-variant">Loading…</div>;

  return (
    <div className="py-stack-lg max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-headline-lg text-on-surface mb-1">Medical History</h1>
        <p className="text-on-surface-variant text-body-md">Keep your health information up to date for better care.</p>
      </div>

      {/* Allergies */}
      <section>
        <h2 className="font-display text-headline-sm text-on-surface mb-3">Allergies</h2>
        <div className="space-y-2 mb-3">
          {(patient?.allergies ?? []).length === 0 && (
            <p className="text-on-surface-variant text-body-md">No allergies recorded.</p>
          )}
          {(patient?.allergies ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
              <span className="text-body-md text-on-surface">{a.name}</span>
              <button
                onClick={() => handleDeleteAllergy(a.id)}
                className="text-error text-label-sm hover:opacity-70"
                aria-label={`Remove ${a.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddAllergy} className="flex gap-2">
          <input
            type="text"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            placeholder="Add allergy…"
            className="flex-1 border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          />
          <button type="submit" className="bg-secondary text-on-secondary rounded px-4 py-2 font-semibold text-body-md hover:opacity-90">
            Add
          </button>
        </form>
      </section>

      {/* Medications */}
      <section>
        <h2 className="font-display text-headline-sm text-on-surface mb-3">Current Medications</h2>
        <div className="space-y-2 mb-3">
          {(patient?.medications ?? []).length === 0 && (
            <p className="text-on-surface-variant text-body-md">No medications recorded.</p>
          )}
          {(patient?.medications ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
              <span className="text-body-md text-on-surface">{m.name}</span>
              <button
                onClick={() => handleDeleteMedication(m.id)}
                className="text-error text-label-sm hover:opacity-70"
                aria-label={`Remove ${m.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddMedication} className="flex gap-2">
          <input
            type="text"
            value={medInput}
            onChange={(e) => setMedInput(e.target.value)}
            placeholder="Add medication…"
            className="flex-1 border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          />
          <button type="submit" className="bg-secondary text-on-secondary rounded px-4 py-2 font-semibold text-body-md hover:opacity-90">
            Add
          </button>
        </form>
      </section>

      {/* Conditions */}
      <section>
        <h2 className="font-display text-headline-sm text-on-surface mb-3">Medical Conditions</h2>
        <div className="space-y-2 mb-3">
          {(patient?.conditions ?? []).length === 0 && (
            <p className="text-on-surface-variant text-body-md">No conditions recorded.</p>
          )}
          {(patient?.conditions ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
              <span className="text-body-md text-on-surface">{c.name}</span>
              <button
                onClick={() => handleDeleteCondition(c.id)}
                className="text-error text-label-sm hover:opacity-70"
                aria-label={`Remove ${c.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCondition} className="flex gap-2">
          <input
            type="text"
            value={conditionInput}
            onChange={(e) => setConditionInput(e.target.value)}
            placeholder="Add condition…"
            className="flex-1 border-2 border-outline-variant rounded px-3 py-2 text-body-md focus:outline-none focus:border-primary"
          />
          <button type="submit" className="bg-secondary text-on-secondary rounded px-4 py-2 font-semibold text-body-md hover:opacity-90">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
