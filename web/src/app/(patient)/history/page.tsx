"use client";
import { useState } from "react";
import {
  getMe, addAllergy, deleteAllergy, addMedication, deleteMedication, addCondition, deleteCondition,
  Patient, ApiError,
} from "@/lib/api";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";
import TopAppBar from "@/components/TopAppBar";
import BottomNavBar from "@/components/BottomNavBar";

function MedSection({
  title,
  icon,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onDelete,
  placeholder,
  isPending,
}: {
  title: string;
  icon: string;
  items: Array<{ id: string; name: string }>;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
  placeholder: string;
  isPending?: boolean;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
        <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-primary">{title}</h2>
        <span className="ml-auto font-label-sm text-on-surface-variant text-xs">{items.length} recorded</span>
      </div>
      <div className="p-6 space-y-3">
        {items.length === 0 ? (
          <p className="font-body-md text-on-surface-variant text-sm">No {title.toLowerCase()} recorded.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3 border border-outline-variant/30">
                <span className="font-body-md text-on-surface">{item.name}</span>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-on-surface-variant hover:text-error transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={onAdd} className="flex gap-2 pt-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isPending}
            className="bg-secondary text-white rounded-xl px-5 font-manrope font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add
          </button>
        </form>
      </div>
    </section>
  );
}

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const { toast } = useToast();
  const [allergyInput, setAllergyInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");

  // F-053: useQuery for initial fetch; F-056: use isLoading from query
  const { data: patient, isLoading: loading } = useQuery({
    queryKey: ["patient-me"],
    queryFn: getMe,
    enabled: !!token,
  });

  function onMutationError(err: unknown) {
    const { title, detail } = err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
    toast.error(title, { detail, correlationId: err instanceof ApiError ? err.correlationId : undefined });
  }

  // F-054: useMutation with onSuccess invalidation for all write operations
  const addAllergyMutation = useMutation({
    mutationFn: (value: string) => addAllergy(value, "mild"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  const addMedicationMutation = useMutation({
    mutationFn: (value: string) => addMedication(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  const addConditionMutation = useMutation({
    mutationFn: (value: string) => addCondition(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  const deleteAllergyMutation = useMutation({
    mutationFn: (id: string) => deleteAllergy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  const deleteMedicationMutation = useMutation({
    mutationFn: (id: string) => deleteMedication(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  const deleteConditionMutation = useMutation({
    mutationFn: (id: string) => deleteCondition(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-me"] }),
    onError: onMutationError,
  });

  function handleAddAllergy(e: React.FormEvent) {
    e.preventDefault();
    if (!allergyInput.trim()) return;
    addAllergyMutation.mutate(allergyInput.trim(), {
      onSuccess: () => setAllergyInput(""),
    });
  }

  function handleAddMedication(e: React.FormEvent) {
    e.preventDefault();
    if (!medInput.trim()) return;
    addMedicationMutation.mutate(medInput.trim(), {
      onSuccess: () => setMedInput(""),
    });
  }

  function handleAddCondition(e: React.FormEvent) {
    e.preventDefault();
    if (!conditionInput.trim()) return;
    addConditionMutation.mutate(conditionInput.trim(), {
      onSuccess: () => setConditionInput(""),
    });
  }

  return (
    <>
      <TopAppBar activeNav="records" />

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-patient-margin max-w-3xl mx-auto">
        <section className="mb-stack-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary">Medical History</h1>
          <p className="font-body-md text-on-surface-variant mt-1">
            Keep your health information up to date for better care.
          </p>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="space-y-6">
            <MedSection
              title="Allergies"
              icon="warning"
              items={patient?.allergies ?? []}
              inputValue={allergyInput}
              onInputChange={setAllergyInput}
              onAdd={handleAddAllergy}
              onDelete={(id) => deleteAllergyMutation.mutate(id)}
              placeholder="e.g. Penicillin, Peanuts…"
              isPending={addAllergyMutation.isPending}
            />
            <MedSection
              title="Current Medications"
              icon="medication"
              items={patient?.medications ?? []}
              inputValue={medInput}
              onInputChange={setMedInput}
              onAdd={handleAddMedication}
              onDelete={(id) => deleteMedicationMutation.mutate(id)}
              placeholder="e.g. Metformin 500mg…"
              isPending={addMedicationMutation.isPending}
            />
            <MedSection
              title="Medical Conditions"
              icon="health_and_safety"
              items={patient?.conditions ?? []}
              inputValue={conditionInput}
              onInputChange={setConditionInput}
              onAdd={handleAddCondition}
              onDelete={(id) => deleteConditionMutation.mutate(id)}
              placeholder="e.g. Type 2 Diabetes…"
              isPending={addConditionMutation.isPending}
            />
          </div>
        )}
      </main>

      <BottomNavBar active="history" />
    </>
  );
}
