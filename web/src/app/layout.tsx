"use client";
import "./globals.css";
import { useState, useEffect } from "react";
import { AuthContext } from "@/hooks/useAuth";
import { getUserRole, hydrateToken } from "@/lib/auth";
import { setToken as apiSetToken, ApiError } from "@/lib/api";
import { ToastProvider } from "@/components/ToastProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// P-01 F-052 / P-02 F-057–F-059: QueryClient defined at module scope so it
// persists across renders within a session.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // F-052
      retry: (failureCount, error) => {
        // F-058: do not retry 4xx errors
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2; // F-057: up to 2 retries
      },
      retryDelay: (attempt) => (attempt === 0 ? 1000 : 2000), // F-059
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

  function setToken(t: string | null) {
    setTokenState(t);
    apiSetToken(t);
  }

  // F-072 / F-073: Restore valid token from sessionStorage on mount.
  // hydrateToken() already clears expired tokens internally.
  useEffect(() => {
    const saved = hydrateToken();
    if (saved) {
      setToken(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const role = getUserRole(token);

  return (
    <html lang="en">
      <head>
        <title>Nightingale</title>
        <meta name="description" content="AI-assisted telehealth with doctor review" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthContext.Provider value={{ token, setToken, role }}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </ToastProvider>
          </QueryClientProvider>
        </AuthContext.Provider>
      </body>
    </html>
  );
}
