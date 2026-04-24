"use client";
import { useContext } from "react";
import { ToastContext, ToastItem, ToastLevel } from "@/hooks/useToast";

const LEVEL_CLASSES: Record<ToastLevel, string> = {
  error: "bg-error-container text-on-error-container",
  warning: "bg-amber-100 text-amber-800",
  success: "bg-tertiary-container text-on-tertiary-container",
  info: "bg-surface-container text-on-surface",
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`w-80 rounded-lg shadow-lg p-4 flex flex-col gap-1 ${LEVEL_CLASSES[item.level]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-body-md font-semibold flex-1">{item.title}</p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
      {item.detail && <p className="text-body-sm">{item.detail}</p>}
      {item.correlationId && (
        <p className="text-body-sm opacity-60 font-mono">
          Reference: {item.correlationId}
        </p>
      )}
    </div>
  );
}

export function Toast() {
  const { toasts, removeToast } = useContext(ToastContext);
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end"
    >
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={() => removeToast(item.id)}
        />
      ))}
    </div>
  );
}
