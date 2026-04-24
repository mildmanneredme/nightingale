"use client";
import { createContext, useContext, useState, useCallback } from "react";

export type ToastLevel = "error" | "warning" | "success" | "info";

export interface ToastItem {
  id: string;
  level: ToastLevel;
  title: string;
  detail?: string;
  correlationId?: string;
  autoDismissMs: number;
}

export interface ToastOptions {
  detail?: string;
  correlationId?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (level: ToastLevel, title: string, opts?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

const DISMISS_MS: Record<ToastLevel, number> = {
  error: 8000,
  warning: 6000,
  success: 3000,
  info: 4000,
};

export function useToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (level: ToastLevel, title: string, opts?: ToastOptions) => {
      const id = Math.random().toString(36).slice(2, 10);
      const item: ToastItem = {
        id,
        level,
        title,
        detail: opts?.detail,
        correlationId: opts?.correlationId,
        autoDismissMs: DISMISS_MS[level],
      };
      setToasts((prev) => [...prev.slice(-2), item]); // keep max 3 (prev 2 + new 1)
      setTimeout(() => removeToast(id), item.autoDismissMs);
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    toast: {
      error: (title: string, opts?: ToastOptions) =>
        ctx.addToast("error", title, opts),
      warning: (title: string, opts?: ToastOptions) =>
        ctx.addToast("warning", title, opts),
      success: (title: string, opts?: ToastOptions) =>
        ctx.addToast("success", title, opts),
      info: (title: string, opts?: ToastOptions) =>
        ctx.addToast("info", title, opts),
    },
  };
}
