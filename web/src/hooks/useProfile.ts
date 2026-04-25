"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, updateMe, Patient, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { signOut as authSignOut } from "@/lib/auth";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

export function useProfile() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { toast } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const fields: Parameters<typeof updateMe>[0] = { firstName, lastName, dateOfBirth, phone };
      if (patient?.isPaediatric) {
        fields.guardianName = guardianName;
        fields.guardianEmail = guardianEmail;
        fields.guardianRelationship = guardianRelationship;
      }
      await updateMe(fields);
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

  function handleSignOut() {
    authSignOut();
    setToken(null);
    router.replace("/login");
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || patient?.email || "Patient";
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "P";

  return {
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
  };
}
