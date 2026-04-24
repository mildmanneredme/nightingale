"use client";
import "./globals.css";
import { useState } from "react";
import { AuthContext } from "@/hooks/useAuth";
import { getUserRole } from "@/lib/auth";
import { setToken as apiSetToken } from "@/lib/api";
import { ToastProvider } from "@/components/ToastProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

  function setToken(t: string | null) {
    setTokenState(t);
    apiSetToken(t);
  }

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
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthContext.Provider>
      </body>
    </html>
  );
}
