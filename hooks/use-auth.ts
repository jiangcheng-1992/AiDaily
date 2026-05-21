"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  createdAt: string;
};

export type AuthPersistence = {
  dataDir: string;
  usingRailwayVolume: boolean;
  stable: boolean;
  databaseConfigured?: boolean;
  backend?: "database" | "file";
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  persistence: AuthPersistence | null;
};

type AuthInput = {
  email: string;
  password: string;
  name?: string;
};

function dispatchAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("aiq-auth-change"));
}

async function parseAuthResponse(response: Response) {
  const data = (await response.json()) as {
    ok?: boolean;
    user?: AuthUser | null;
    persistence?: AuthPersistence | null;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "操作失败，请稍后重试");
  }

  return {
    user: data.user ?? null,
    persistence: data.persistence ?? null,
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    persistence: null,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await parseAuthResponse(response);
      setState({ user: result.user, loading: false, persistence: result.persistence });
      return result.user;
    } catch {
      setState((current) => ({ user: null, loading: false, persistence: current.persistence }));
      return null;
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });

    function handleAuthChange() {
      void refresh();
    }

    window.addEventListener("focus", handleAuthChange);
    window.addEventListener("aiq-auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("focus", handleAuthChange);
      window.removeEventListener("aiq-auth-change", handleAuthChange);
    };
  }, [refresh]);

  const register = useCallback(async ({ email, password, name }: AuthInput) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password, name }),
    });
    const result = await parseAuthResponse(response);
    setState((current) => ({
      user: result.user,
      loading: false,
      persistence: current.persistence,
    }));
    dispatchAuthChange();
    void refresh();

    return result.user;
  }, [refresh]);

  const login = useCallback(async ({ email, password }: AuthInput) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const result = await parseAuthResponse(response);
    setState((current) => ({
      user: result.user,
      loading: false,
      persistence: current.persistence,
    }));
    dispatchAuthChange();
    void refresh();

    return result.user;
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setState((current) => ({ user: null, loading: false, persistence: current.persistence }));
    dispatchAuthChange();
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    persistence: state.persistence,
    isLoggedIn: Boolean(state.user),
    login,
    register,
    logout,
  };
}
