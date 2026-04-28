"use client";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthModal from "@/components/AuthModal";

// Renders the AuthModal when ?auth=1 is present in the URL.
// Wrapped in Suspense by the parent so useSearchParams doesn't block SSR.
export default function AuthGate() {
  const searchParams = useSearchParams();
  // Local dismissed flag so the modal can be closed without a URL navigation
  // completing (avoids flash on router.replace)
  const [dismissed, setDismissed] = useState(false);

  const show = searchParams.get("auth") === "1" && !dismissed;

  const handleClose = useCallback(() => setDismissed(true), []);

  // Reset dismissed state if the param changes (e.g. user navigates to ?auth=1 again)
  // by keying on the param value — component remounts when key changes.
  if (!show) return null;
  return <AuthModal onClose={handleClose} />;
}
