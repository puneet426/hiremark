"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, AppConfig, setCsrf, User } from "./api";

type Ctx = { user: User | null; config: AppConfig | null; loading: boolean; refresh: () => Promise<User | null>; setUser: (u: User | null) => void };
const AuthContext = createContext<Ctx>({ user: null, config: null, loading: true, refresh: async () => null, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User | null) => {
    if (u?.csrf) setCsrf(u.csrf);
    if (!u) setCsrf("");
    setUserState(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await api<{ user: User | null; config: AppConfig }>("/auth/me");
      setUser(d.user);
      setConfig(d.config);
      return d.user;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ user, config, loading, refresh, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
