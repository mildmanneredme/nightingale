"use client";
import { createContext, useContext } from "react";

export interface AuthContextValue {
  token: string | null;
  setToken: (t: string | null) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  setToken: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
