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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
