import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import postgres from "postgres";

export const authSessionCookie = "aiq_session";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  createdAt: string;
  isAdmin?: boolean;
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

type AuthUserRow = {
  id: string;
  name: string;
  email: string;
  avatar_text: string;
  created_at: string;
  salt: string;
  password_hash: string;
};

const emptyStore: AuthStore = {
  users: [],
  sessions: [],
};

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const railwayVolumeDir = "/data";
const sessionTokenPrefix = "v1";
let authDb:
  | ReturnType<typeof postgres>
  | null = null;
let authDbReady: Promise<void> | null = null;

export function getAuthStorePath() {
  const dataDir = resolveAuthDataDir();
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
    isAdmin: isAdminEmail(user.email),
  };
}

export function isAdminEmail(email?: string | null) {
  const cleanEmail = normalizeEmail(email ?? "");
  if (!cleanEmail) return false;

  const configuredEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  if (configuredEmails.length > 0) {
    return configuredEmails.includes(cleanEmail);
  }

  // Local-only convenience: production must explicitly set ADMIN_EMAILS.
  return process.env.NODE_ENV !== "production";
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
    // #region debug-point A:read-store
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"A",location:"auth-store.ts:readStore",msg:"[DEBUG] auth store loaded",data:{filePath,users:Array.isArray(parsed.users)?parsed.users.length:0,sessions:Array.isArray(parsed.sessions)?parsed.sessions.length:0},ts:Date.now()})}).catch(()=>{})})();
    // #endregion

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

  const signedUser = verifySignedSessionToken(sessionId);
  if (signedUser) {
    // #region debug-point E:signed-session-hit
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"E",location:"auth-store.ts:getUserBySession:signed",msg:"[DEBUG] signed session accepted",data:{userId:signedUser.id,email:signedUser.email},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    return signedUser;
  }

  const store = await readStore();
  const sessions = pruneExpiredSessions(store.sessions);
  const session = sessions.find((item) => item.id === sessionId);

  if (sessions.length !== store.sessions.length) {
    await writeStore({ ...store, sessions });
  }

  if (!session) return null;

  const user = store.users.find((item) => item.id === session.userId);
  // #region debug-point E:store-session-fallback
  (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"E",location:"auth-store.ts:getUserBySession:store",msg:"[DEBUG] store session fallback checked",data:{sessionFound:Boolean(session),userFound:Boolean(user),sessionIdPrefix:String(sessionId).slice(0,8),sessions:sessions.length,users:store.users.length},ts:Date.now()})}).catch(()=>{})})();
  // #endregion
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

  if (hasDatabaseAuth()) {
    await ensureAuthDatabase();
    const sql = getAuthDatabase();
    // #region debug-point B:register-start
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"B",location:"auth-store.ts:registerUser:start",msg:"[DEBUG] register attempt",data:{email:cleanEmail,backend:"database",databaseConfigured:true},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    const existing = (await sql`
      select id
      from auth_users
      where email = ${cleanEmail}
      limit 1
    `) as Array<{ id: string }>;
    if (existing.length > 0) {
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
    await sql`
      insert into auth_users (
        id,
        name,
        email,
        avatar_text,
        created_at,
        salt,
        password_hash
      ) values (
        ${user.id},
        ${user.name},
        ${user.email},
        ${user.avatarText},
        ${user.createdAt},
        ${user.salt},
        ${user.passwordHash}
      )
    `;
    // #region debug-point B:register-written
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"B",location:"auth-store.ts:registerUser:written",msg:"[DEBUG] register persisted",data:{email:cleanEmail,userId:user.id,backend:"database"},ts:Date.now()})}).catch(()=>{})})();
    // #endregion

    return {
      user: publicUser(user),
      sessionId: createSignedSessionToken(publicUser(user)),
    };
  }

  const store = await readStore();
  // #region debug-point B:register-start
  (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"B",location:"auth-store.ts:registerUser:start",msg:"[DEBUG] register attempt",data:{email:cleanEmail,dataDir:resolveAuthDataDir(),storePath:getAuthStorePath(),users:store.users.length,sessions:store.sessions.length},ts:Date.now()})}).catch(()=>{})})();
  // #endregion
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
  // #region debug-point B:register-written
  (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"B",location:"auth-store.ts:registerUser:written",msg:"[DEBUG] register persisted",data:{email:cleanEmail,userId:user.id,storePath:getAuthStorePath()},ts:Date.now()})}).catch(()=>{})})();
  // #endregion

  return {
    user: publicUser(user),
    sessionId: createSignedSessionToken(publicUser(user)),
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

  if (hasDatabaseAuth()) {
    await ensureAuthDatabase();
    const sql = getAuthDatabase();
    const rows = (await sql`
      select
        id,
        name,
        email,
        avatar_text,
        created_at,
        salt,
        password_hash
      from auth_users
      where email = ${cleanEmail}
      limit 1
    `) as AuthUserRow[];
    const user = rows[0] ? mapDbUser(rows[0]) : undefined;
    const passwordOk = user ? verifyPassword(password, user.salt, user.passwordHash) : false;
    // #region debug-point C:login-check
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"C",location:"auth-store.ts:loginUser",msg:"[DEBUG] login credentials checked",data:{email:cleanEmail,backend:"database",userFound:Boolean(user),passwordOk},ts:Date.now()})}).catch(()=>{})})();
    // #endregion

    if (!user || !passwordOk) {
      throw new Error("账号或密码不正确");
    }

    return {
      user: publicUser(user),
      sessionId: createSignedSessionToken(publicUser(user)),
    };
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === cleanEmail);
  const passwordOk = user ? verifyPassword(password, user.salt, user.passwordHash) : false;
  // #region debug-point C:login-check
  (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"C",location:"auth-store.ts:loginUser",msg:"[DEBUG] login credentials checked",data:{email:cleanEmail,dataDir:resolveAuthDataDir(),storePath:getAuthStorePath(),users:store.users.length,userFound:Boolean(user),passwordOk},ts:Date.now()})}).catch(()=>{})})();
  // #endregion

  if (!user || !passwordOk) {
    throw new Error("账号或密码不正确");
  }

  const session = createSession(user.id);
  await writeStore({
    ...store,
    sessions: [session, ...pruneExpiredSessions(store.sessions)],
  });

  return {
    user: publicUser(user),
    sessionId: createSignedSessionToken(publicUser(user)),
  };
}

export async function logoutUser(sessionId?: string | null) {
  if (!sessionId) return;

  if (verifySignedSessionToken(sessionId)) {
    return;
  }

  const store = await readStore();
  await writeStore({
    ...store,
    sessions: store.sessions.filter((session) => session.id !== sessionId),
  });
}

export function getAuthPersistenceInfo() {
  const dataDir = resolveAuthDataDir();
  const usingRailwayVolume = dataDir === railwayVolumeDir;
  const databaseConfigured = hasDatabaseAuth();

  return {
    dataDir,
    usingRailwayVolume,
    databaseConfigured,
    backend: databaseConfigured ? "database" : "file",
    stable:
      databaseConfigured ||
      usingRailwayVolume ||
      process.env.NODE_ENV !== "production" ||
      !process.env.RAILWAY_ENVIRONMENT_NAME,
  };
}

function resolveAuthDataDir() {
  if (process.env.AIQ_DATA_DIR?.trim()) {
    return process.env.AIQ_DATA_DIR.trim();
  }

  if (existsSync(railwayVolumeDir)) {
    return railwayVolumeDir;
  }

  return join(process.cwd(), "data");
}

function hasDatabaseAuth() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getAuthDatabase() {
  if (!hasDatabaseAuth()) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!authDb) {
    authDb = postgres(process.env.DATABASE_URL!.trim(), {
      max: 1,
      prepare: false,
    });
  }

  return authDb;
}

async function ensureAuthDatabase() {
  if (!hasDatabaseAuth()) return;
  if (!authDbReady) {
    const sql = getAuthDatabase();
    authDbReady = (async () => {
      await sql`
        create table if not exists auth_users (
          id text primary key,
          name text not null,
          email text not null unique,
          avatar_text text not null,
          created_at timestamptz not null,
          salt text not null,
          password_hash text not null
        )
      `;
      await sql`
        create index if not exists auth_users_created_at_idx
        on auth_users (created_at desc)
      `;
    })();
  }

  await authDbReady;
}

function mapDbUser(row: AuthUserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarText: row.avatar_text,
    createdAt: new Date(row.created_at).toISOString(),
    salt: row.salt,
    passwordHash: row.password_hash,
  };
}

function createSignedSessionToken(user: AuthUser) {
  const payload = {
    ...user,
    exp: Date.now() + sessionMaxAgeSeconds * 1000,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload);

  return `${sessionTokenPrefix}.${encodedPayload}.${signature}`;
}

function verifySignedSessionToken(token: string): AuthUser | null {
  const [prefix, encodedPayload, signature] = token.split(".");
  if (prefix !== sessionTokenPrefix || !encodedPayload || !signature) return null;

  const expectedSignature = signSessionPayload(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as AuthUser & {
      exp?: number;
    };

    if (!payload.exp || payload.exp <= Date.now()) return null;

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      avatarText: payload.avatarText,
      createdAt: payload.createdAt,
      isAdmin: isAdminEmail(payload.email),
    };
  } catch {
    return null;
  }
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "aiq-local-dev-session-secret"
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
