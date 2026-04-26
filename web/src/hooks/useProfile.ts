"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  updateMe,
  addAllergy,
  deleteAllergy,
  addMedication,
  deleteMedication,
  addCondition,
  deleteCondition,
  Patient,
  Allergy,
  Medication,
  Condition,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { signOut as authSignOut } from "@/lib/auth";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

// PRD-023: client-side per-section completeness so the profile page can show
// sub-percentages without another API round-trip. Stays in sync with the
// server-side computeCompleteness() in routes/patients.ts by mirroring the
// same field weighting (each named field + each clinical-baseline section
// counts as one slot).

interface SectionCompleteness {
  filled: number;
  total: number;
  pct: number;
}

function pct(filled: number, total: number): SectionCompleteness {
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

export function useProfile() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  // Address & healthcare
  const [address, setAddress] = useState("");
  const [medicareNumber, setMedicareNumber] = useState("");
  const [gpName, setGpName] = useState("");
  const [gpClinic, setGpClinic] = useState("");

  // Clinical baseline (none-declared toggles; lists are read straight from
  // patient state so add/delete always shows fresh data)
  const [allergiesNone, setAllergiesNone] = useState(false);
  const [medicationsNone, setMedicationsNone] = useState(false);
  const [conditionsNone, setConditionsNone] = useState(false);

  // Guardian (paediatric only)
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  // Inline add forms
  const [newAllergy, setNewAllergy] = useState({ name: "", severity: "moderate" as Allergy["severity"] });
  const [newMedication, setNewMedication] = useState({ name: "", dose: "", frequency: "" });
  const [newCondition, setNewCondition] = useState("");

  function hydrate(p: Patient) {
    setPatient(p);
    setFirstName(p.firstName ?? "");
    setLastName(p.lastName ?? "");
    setPreferredName(p.preferredName ?? "");
    setDateOfBirth(p.dateOfBirth ?? "");
    setPhone(p.phone ?? "");
    setAddress(p.address ?? "");
    setMedicareNumber(p.medicareNumber ?? "");
    setGpName(p.gpName ?? "");
    setGpClinic(p.gpClinic ?? "");
    setAllergiesNone(p.allergiesNoneDeclared ?? false);
    setMedicationsNone(p.medicationsNoneDeclared ?? false);
    setConditionsNone(p.conditionsNoneDeclared ?? false);
    setGuardianName(p.guardianName ?? "");
    setGuardianEmail(p.guardianEmail ?? "");
    setGuardianRelationship(p.guardianRelationship ?? "");
  }

  useEffect(() => {
    getMe()
      .then(hydrate)
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    const fresh = await getMe();
    hydrate(fresh);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const fields: Parameters<typeof updateMe>[0] = {
        firstName,
        lastName,
        preferredName,
        dateOfBirth,
        phone,
        address,
        medicareNumber: medicareNumber || undefined,
        gpName,
        gpClinic,
        allergiesNoneDeclared: allergiesNone,
        medicationsNoneDeclared: medicationsNone,
        conditionsNoneDeclared: conditionsNone,
      };
      if (patient?.isPaediatric) {
        fields.guardianName = guardianName;
        fields.guardianEmail = guardianEmail;
        fields.guardianRelationship = guardianRelationship;
      }
      await updateMe(fields);
      await refresh();
      toast.success("Profile saved", { detail: "Your details have been updated." });
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

  // ---------------------------------------------------------------------------
  // Inline clinical-baseline add/delete — wired straight to the per-item endpoints
  // ---------------------------------------------------------------------------

  async function handleAddAllergy() {
    if (!newAllergy.name.trim()) return;
    try {
      await addAllergy(newAllergy.name.trim(), newAllergy.severity);
      setNewAllergy({ name: "", severity: "moderate" });
      // Adding a record clears the "none known" claim — the data now contradicts it.
      if (allergiesNone) {
        setAllergiesNone(false);
        await updateMe({ allergiesNoneDeclared: false });
      }
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not add allergy", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDeleteAllergy(id: string) {
    try {
      await deleteAllergy(id);
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not remove allergy", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleAddMedication() {
    if (!newMedication.name.trim()) return;
    try {
      await addMedication(
        newMedication.name.trim(),
        newMedication.dose.trim() || undefined,
        newMedication.frequency.trim() || undefined
      );
      setNewMedication({ name: "", dose: "", frequency: "" });
      if (medicationsNone) {
        setMedicationsNone(false);
        await updateMe({ medicationsNoneDeclared: false });
      }
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not add medication", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDeleteMedication(id: string) {
    try {
      await deleteMedication(id);
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not remove medication", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleAddCondition() {
    if (!newCondition.trim()) return;
    try {
      await addCondition(newCondition.trim());
      setNewCondition("");
      if (conditionsNone) {
        setConditionsNone(false);
        await updateMe({ conditionsNoneDeclared: false });
      }
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not add condition", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDeleteCondition(id: string) {
    try {
      await deleteCondition(id);
      await refresh();
    } catch (err: unknown) {
      toast.error("Could not remove condition", {
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function handleSignOut() {
    authSignOut();
    setToken(null);
    router.replace("/login");
  }

  // ---------------------------------------------------------------------------
  // Section completeness — recomputed from local state so the bars react to
  // the current form values, not a stale server response.
  // ---------------------------------------------------------------------------

  const personalCompleteness = useMemo<SectionCompleteness>(() => {
    const fields = [firstName, lastName, dateOfBirth, phone];
    return pct(fields.filter((v) => v.trim()).length, fields.length);
  }, [firstName, lastName, dateOfBirth, phone]);

  const addressHealthcareCompleteness = useMemo<SectionCompleteness>(() => {
    // Only address counts as required; the other three are optional but they
    // still contribute to the visible bar so the user knows what's missing.
    const fields = [address, medicareNumber, gpName, gpClinic];
    return pct(fields.filter((v) => v.trim()).length, fields.length);
  }, [address, medicareNumber, gpName, gpClinic]);

  const baselineCompleteness = useMemo<SectionCompleteness>(() => {
    const allergiesAnswered =
      allergiesNone || (patient?.allergies?.length ?? 0) > 0;
    const medicationsAnswered =
      medicationsNone || (patient?.medications?.length ?? 0) > 0;
    const conditionsAnswered =
      conditionsNone || (patient?.conditions?.length ?? 0) > 0;
    const filled = [allergiesAnswered, medicationsAnswered, conditionsAnswered].filter(Boolean).length;
    return pct(filled, 3);
  }, [allergiesNone, medicationsNone, conditionsNone, patient?.allergies, patient?.medications, patient?.conditions]);

  const displayName =
    preferredName.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    patient?.email ||
    "Patient";
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "P";

  return {
    patient,
    loading,
    saving,
    // Personal
    firstName, setFirstName,
    lastName, setLastName,
    preferredName, setPreferredName,
    dateOfBirth, setDateOfBirth,
    phone, setPhone,
    // Address & healthcare
    address, setAddress,
    medicareNumber, setMedicareNumber,
    gpName, setGpName,
    gpClinic, setGpClinic,
    // Clinical baseline
    allergiesNone, setAllergiesNone,
    medicationsNone, setMedicationsNone,
    conditionsNone, setConditionsNone,
    allergies: (patient?.allergies ?? []) as Allergy[],
    medications: (patient?.medications ?? []) as Medication[],
    conditions: (patient?.conditions ?? []) as Condition[],
    newAllergy, setNewAllergy, handleAddAllergy, handleDeleteAllergy,
    newMedication, setNewMedication, handleAddMedication, handleDeleteMedication,
    newCondition, setNewCondition, handleAddCondition, handleDeleteCondition,
    // Guardian
    guardianName, setGuardianName,
    guardianEmail, setGuardianEmail,
    guardianRelationship, setGuardianRelationship,
    // Derived
    displayName,
    initials,
    personalCompleteness,
    addressHealthcareCompleteness,
    baselineCompleteness,
    // Actions
    handleSubmit,
    handleSignOut,
  };
}
