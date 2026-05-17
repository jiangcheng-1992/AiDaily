"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  createdAt: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
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
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "操作失败，请稍后重试");
  }

  return data.user ?? null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const user = await parseAuthResponse(response);
      setState({ user, loading: false });
      return user;
    } catch {
      setState({ user: null, loading: false });
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
    const user = await parseAuthResponse(response);

    setState({ user, loading: false });
    dispatchAuthChange();

    return user;
  }, []);

  const login = useCallback(async ({ email, password }: AuthInput) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const user = await parseAuthResponse(response);

    setState({ user, loading: false });
    dispatchAuthChange();

    return user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setState({ user: null, loading: false });
    dispatchAuthChange();
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    isLoggedIn: Boolean(state.user),
    login,
    register,
    logout,
  };
}
