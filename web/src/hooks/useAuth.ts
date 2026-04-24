"use client";
import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth";

export interface AuthContextValue {
  token: string | null;
  setToken: (t: string | null) => void;
  role: UserRole | null;
}

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  setToken: () => {},
  role: null,
});

export function useAuth() {
  return useContext(AuthContext);
}
