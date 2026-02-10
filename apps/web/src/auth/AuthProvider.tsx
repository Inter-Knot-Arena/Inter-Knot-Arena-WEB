import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@ika/shared";
import { fetchAuthMe, logout as apiLogout } from "../api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthed: boolean;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = requestSeq;
    setIsLoading(true);
    try {
      const current = await fetchAuthMe();
      if (!isMountedRef.current || refreshSeqRef.current !== requestSeq) {
        return;
      }
      setUser(current);
    } finally {
      if (isMountedRef.current && refreshSeqRef.current === requestSeq) {
        setIsLoading(false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout failures and clear local state.
    }
    if (!isMountedRef.current) {
      return;
    }
    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();
    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthed: Boolean(user), setUser, refresh, logout }),
    [user, isLoading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
