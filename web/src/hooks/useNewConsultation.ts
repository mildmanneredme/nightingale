"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConsultation, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage } from "@/lib/errors";

export type ConsultationType = "voice" | "text";

export function useNewConsultation() {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState<ConsultationType>("voice");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const consultation = await createConsultation(type);
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

  return {
    type,
    setType,
    loading,
    handleSubmit,
  };
}
