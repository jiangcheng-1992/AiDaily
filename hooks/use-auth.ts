"use client";

import { useCallback, useSyncExternalStore } from "react";

const authKeys = {
  users: "aiq.auth.users",
  session: "aiq.auth.session",
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  createdAt: string;
};

type StoredUser = AuthUser & {
  passwordHash: string;
  salt: string;
};

type AuthSession = {
  userId: string;
  createdAt: string;
};

type AuthState = {
  user: AuthUser | null;
};

type AuthInput = {
  email: string;
  password: string;
  name?: string;
};

const emptyAuthState: AuthState = {
  user: null,
};

let lastSerialized = "";
let lastSnapshot: AuthState = emptyAuthState;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAvatarText(name: string, email: string) {
  const value = name.trim() || email.trim();
  return value.slice(0, 1).toUpperCase() || "探";
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readUsers() {
  return readJson<StoredUser[]>(authKeys.users, []);
}

function readSession() {
  return readJson<AuthSession | null>(authKeys.session, null);
}

function dispatchAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("aiq-auth-change"));
}

function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarText: user.avatarText,
    createdAt: user.createdAt,
  };
}

async function hashPassword(password: string, salt: string) {
  const input = `${salt}:${password}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return String(hash);
}

function readAuthState(): AuthState {
  if (typeof window === "undefined") return emptyAuthState;

  const session = readSession();
  const user = session
    ? readUsers().find((storedUser) => storedUser.id === session.userId)
    : null;
  const snapshot: AuthState = {
    user: user ? publicUser(user) : null,
  };
  const serialized = JSON.stringify(snapshot);

  if (serialized === lastSerialized) {
    return lastSnapshot;
  }

  lastSerialized = serialized;
  lastSnapshot = snapshot;
  return snapshot;
}

function subscribeToAuth(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("aiq-auth-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("aiq-auth-change", onStoreChange);
  };
}

export function useAuth() {
  const state = useSyncExternalStore(
    subscribeToAuth,
    readAuthState,
    () => emptyAuthState,
  );

  const register = useCallback(async ({ email, password, name }: AuthInput) => {
    const cleanEmail = normalizeEmail(email);
    const cleanName = name?.trim() || "AI 探索者";

    if (!cleanEmail || !password || !cleanName) {
      throw new Error("请填写完整的注册信息");
    }

    if (password.length < 6) {
      throw new Error("密码至少需要 6 位");
    }

    const users = readUsers();
    if (users.some((user) => user.email === cleanEmail)) {
      throw new Error("这个邮箱已经注册过了");
    }

    const salt = createId("salt");
    const user: StoredUser = {
      id: createId("user"),
      name: cleanName,
      email: cleanEmail,
      avatarText: getAvatarText(cleanName, cleanEmail),
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(password, salt),
    };

    writeJson(authKeys.users, [user, ...users]);
    writeJson(authKeys.session, {
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    dispatchAuthChange();

    return publicUser(user);
  }, []);

  const login = useCallback(async ({ email, password }: AuthInput) => {
    const cleanEmail = normalizeEmail(email);
    const user = readUsers().find((storedUser) => storedUser.email === cleanEmail);

    if (!user) {
      throw new Error("账号或密码不正确");
    }

    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      throw new Error("账号或密码不正确");
    }

    writeJson(authKeys.session, {
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    dispatchAuthChange();

    return publicUser(user);
  }, []);

  const logout = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(authKeys.session);
    dispatchAuthChange();
  }, []);

  return {
    user: state.user,
    isLoggedIn: Boolean(state.user),
    login,
    register,
    logout,
  };
}
