"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

export const NEW_CONSULTATION_MAX_CHARS = 200;

export type ConsultationType = "voice" | "text";

export function useNewConsultation() {
  const router = useRouter();
  const { toast } = useToast();
  const [complaint, setComplaintRaw] = useState("");
  const [type, setType] = useState<ConsultationType>("voice");
  const [loading, setLoading] = useState(false);

  function setComplaint(value: string) {
    setComplaintRaw(value.slice(0, NEW_CONSULTATION_MAX_CHARS));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complaint.trim()) return;
    setLoading(true);
    try {
      const consultation = await createConsultation(type, complaint.trim());
      if (type === "voice") {
        router.push(`/consultation/${consultation.id}/audio-check`);
      } else {
        router.push(`/consultation/${consultation.id}/text`);
      }
    } catch (err: unknown) {
      const { title, detail } =
        err instanceof ApiError ? getErrorMessage(err.status) : getErrorMessage(0);
      toast.error(title, {
        detail,
        correlationId: err instanceof ApiError ? err.correlationId : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = complaint.trim().length > 0 && !loading;

  return {
    complaint,
    setComplaint,
    type,
    setType,
    loading,
    canSubmit,
    handleSubmit,
    maxChars: NEW_CONSULTATION_MAX_CHARS,
  };
}
