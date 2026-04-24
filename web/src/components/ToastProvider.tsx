"use client";
import { ToastContext, useToastProvider } from "@/hooks/useToast";
import { Toast } from "./Toast";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const value = useToastProvider();
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast />
    </ToastContext.Provider>
  );
}
