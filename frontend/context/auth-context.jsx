"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  API_URL,
  apiFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/api";

const AuthContext = createContext(null);
const IMPERSONATION_KEY = "ami_impersonation_context";
/** Backup if sessionStorage is unavailable or cleared (same-origin, tab-persistent) */
const IMPERSONATION_BACKUP_KEY = "ami_impersonation_backup";

function readImpersonationRaw() {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = sessionStorage.getItem(IMPERSONATION_KEY);
    if (fromSession) return fromSession;
    return localStorage.getItem(IMPERSONATION_BACKUP_KEY);
  } catch {
    return null;
  }
}

function getImpersonationContext() {
  const raw = readImpersonationRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setImpersonationContext(ctx) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(ctx);
  try {
    sessionStorage.setItem(IMPERSONATION_KEY, serialized);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(IMPERSONATION_BACKUP_KEY, serialized);
  } catch {
    /* ignore */
  }
}

function clearImpersonationContext() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(IMPERSONATION_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchMe() {
  return apiFetch("/v1/auth/me");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState(null);

  const logout = useCallback(() => {
    clearImpersonationContext();
    setImpersonation(null);
    clearStoredToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      clearImpersonationContext();
      setImpersonation(null);
      setUser(null);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data.user);
      setImpersonation(getImpersonationContext());
    } catch {
      clearImpersonationContext();
      setImpersonation(null);
      clearStoredToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    clearImpersonationContext();
    setImpersonation(null);
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ email, password, name }) => {
    const res = await fetch(`${API_URL}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }
    clearImpersonationContext();
    setImpersonation(null);
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const impersonateCandidate = useCallback(async (candidateUserId) => {
    const adminToken = getStoredToken();
    if (!adminToken || !user) {
      throw new Error("Not authenticated");
    }
    const data = await apiFetch(`/v1/auth/users/${candidateUserId}/impersonate`, {
      method: "POST",
    });
    const ctx = {
      adminToken,
      adminUser: user,
      startedAt: Date.now(),
    };
    setImpersonationContext(ctx);
    setImpersonation(ctx);
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, [user]);

  const switchBackToAdmin = useCallback(async () => {
    const ctx = getImpersonationContext();
    if (!ctx?.adminToken) {
      throw new Error("No super admin session found");
    }
    const { adminToken, adminUser } = ctx;
    clearImpersonationContext();
    setImpersonation(null);
    setStoredToken(adminToken);
    setUser(adminUser || null);
    try {
      const data = await fetchMe();
      setUser(data.user);
    } catch {
      /* Keep restored admin snapshot; do not clear token — refresh() would wipe session */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      impersonation,
      isImpersonating: Boolean(impersonation?.adminToken),
      login,
      register,
      logout,
      refresh,
      impersonateCandidate,
      switchBackToAdmin,
    }),
    [
      user,
      loading,
      impersonation,
      login,
      register,
      logout,
      refresh,
      impersonateCandidate,
      switchBackToAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
