"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getDoctorConsultation,
  approveConsultation,
  DoctorConsultation,
} from "@/lib/api";

export function useDoctorConsultation() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<DoctorConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoctorConsultation(id).then(setConsultation).finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    try {
      await approveConsultation(id);
      router.push("/doctor/queue");
    } finally {
      setApproving(false);
      setShowConfirm(false);
    }
  }

  const soap = consultation?.soapNote as Record<string, string> | null;

  return {
    id,
    consultation,
    loading,
    approving,
    showConfirm,
    setShowConfirm,
    handleApprove,
    soap,
  };
}
