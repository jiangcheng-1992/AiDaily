import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export const authSessionCookie = "aiq_session";

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

type StoredSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type AuthStore = {
  users: StoredUser[];
  sessions: StoredSession[];
};

const emptyStore: AuthStore = {
  users: [],
  sessions: [],
};

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export function getAuthStorePath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "auth-store.json");
}

export function getAuthCookieOptions(request?: Request) {
  const host = request?.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && !isLocalhost,
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  };
}

export function getClearAuthCookieOptions(request?: Request) {
  return {
    ...getAuthCookieOptions(request),
    maxAge: 0,
  };
}

export function publicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarText: user.avatarText,
    createdAt: user.createdAt,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAvatarText(name: string, email: string) {
  const value = name.trim() || email.trim();
  return value.slice(0, 1).toUpperCase() || "探";
}

function createToken() {
  if (typeof randomUUID === "function") return randomUUID();
  return randomBytes(32).toString("hex");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const current = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return current.length === expected.length && timingSafeEqual(current, expected);
}

async function readStore(): Promise<AuthStore> {
  const filePath = getAuthStorePath();

  if (!existsSync(filePath)) return emptyStore;

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthStore>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return emptyStore;
  }
}

async function writeStore(store: AuthStore) {
  const filePath = getAuthStorePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

function pruneExpiredSessions(sessions: StoredSession[]) {
  const now = Date.now();
  return sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

function createSession(userId: string): StoredSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionMaxAgeSeconds * 1000);

  return {
    id: createToken(),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getUserBySession(sessionId?: string | null) {
  if (!sessionId) return null;

  const store = await readStore();
  const sessions = pruneExpiredSessions(store.sessions);
  const session = sessions.find((item) => item.id === sessionId);

  if (sessions.length !== store.sessions.length) {
    await writeStore({ ...store, sessions });
  }

  if (!session) return null;

  const user = store.users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function registerUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = name?.trim() || "AI 探索者";

  if (!cleanEmail || !password || !cleanName) {
    throw new Error("请填写完整的注册信息");
  }

  if (password.length < 6) {
    throw new Error("密码至少需要 6 位");
  }

  const store = await readStore();
  if (store.users.some((user) => user.email === cleanEmail)) {
    throw new Error("这个邮箱已经注册过了");
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: createToken(),
    name: cleanName,
    email: cleanEmail,
    avatarText: getAvatarText(cleanName, cleanEmail),
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: hashPassword(password, salt),
  };
  const session = createSession(user.id);

  await writeStore({
    users: [user, ...store.users],
    sessions: [session, ...pruneExpiredSessions(store.sessions)],
  });

  return {
    user: publicUser(user),
    sessionId: session.id,
  };
}

export async function loginUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const cleanEmail = normalizeEmail(email);
  const store = await readStore();
  const user = store.users.find((item) => item.email === cleanEmail);

  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw new Error("账号或密码不正确");
  }

  const session = createSession(user.id);
  await writeStore({
    ...store,
    sessions: [session, ...pruneExpiredSessions(store.sessions)],
  });

  return {
    user: publicUser(user),
    sessionId: session.id,
  };
}

export async function logoutUser(sessionId?: string | null) {
  if (!sessionId) return;

  const store = await readStore();
  await writeStore({
    ...store,
    sessions: store.sessions.filter((session) => session.id !== sessionId),
  });
}
