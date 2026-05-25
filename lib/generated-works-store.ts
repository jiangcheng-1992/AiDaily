import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  interestingWorks,
  type WorkItem,
} from "@/lib/interesting-works";

export type GeneratedWorks = {
  updatedAt?: string;
  works: WorkItem[];
  sources?: Record<
    string,
    {
      ok: boolean;
      count: number;
      fetchedAt?: string;
      error?: string;
    }
  >;
};

const emptyWorks: GeneratedWorks = {
  works: [],
  sources: {},
};

export function getGeneratedWorksPath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "generated-works.json");
}

export async function readGeneratedWorks(options: { allowFallback?: boolean } = {}) {
  const filePath = getGeneratedWorksPath();
  const allowFallback = options.allowFallback ?? true;

  if (!existsSync(filePath)) {
    return allowFallback ? buildFallbackWorks() : emptyWorks;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as GeneratedWorks;
    const works = Array.isArray(parsed.works) ? parsed.works : [];
    const sanitized = sanitizeGeneratedWorks({
      updatedAt: parsed.updatedAt,
      works,
      sources: parsed.sources ?? {},
    });

    return sanitized.works.length > 0 || !allowFallback ? sanitized : buildFallbackWorks();
  } catch {
    return allowFallback ? buildFallbackWorks() : emptyWorks;
  }
}

export async function readGeneratedWorksStatus() {
  const filePath = getGeneratedWorksPath();
  const persisted = await readGeneratedWorks({ allowFallback: false });

  return {
    filePath,
    exists: existsSync(filePath),
    hasPersistedWorks: persisted.works.length > 0,
    persistedWorkCount: persisted.works.length,
    fallbackActive: persisted.works.length === 0,
    updatedAt: persisted.updatedAt ?? null,
    sources: persisted.sources ?? {},
  };
}

export async function writeGeneratedWorks(nextWorks: GeneratedWorks) {
  const filePath = getGeneratedWorksPath();
  const sanitized = sanitizeGeneratedWorks(nextWorks);

  if (sanitized.works.length === 0 && existsSync(filePath)) {
    const current = await readGeneratedWorks({ allowFallback: false });
    if (current.works.length > 0) {
      throw new Error(`Refusing to overwrite existing works with empty works at ${filePath}`);
    }
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(sanitized, null, 2), "utf8");
}

export function mergeGeneratedWorks({
  current,
  incomingWorks,
  sourceStatus,
  limit = 200,
}: {
  current: GeneratedWorks;
  incomingWorks: WorkItem[];
  sourceStatus?: GeneratedWorks["sources"];
  limit?: number;
}): GeneratedWorks {
  const workMap = new Map<string, WorkItem>();
  const identityMap = new Map<string, string>();

  for (const work of current.works) {
    workMap.set(work.id, work);
    identityMap.set(work.id, buildWorkIdentity(work));
  }

  for (const work of incomingWorks) {
    const existing = workMap.get(work.id);
    const merged = mergeWork(existing, work);
    workMap.set(work.id, merged);
    identityMap.set(work.id, buildWorkIdentity(merged));
  }

  const deduped = new Map<string, WorkItem>();
  for (const work of workMap.values()) {
    const key = identityMap.get(work.id) ?? buildWorkIdentity(work);
    deduped.set(key, mergeWork(deduped.get(key), work));
  }

  return {
    updatedAt: new Date().toISOString(),
    works: Array.from(deduped.values())
      .filter((work) => work.status === "approved")
      .sort(sortWorks)
      .slice(0, limit),
    sources: {
      ...(current.sources ?? {}),
      ...(sourceStatus ?? {}),
    },
  };
}

function sanitizeGeneratedWorks(works: GeneratedWorks): GeneratedWorks {
  return {
    updatedAt: works.updatedAt,
    works: dedupeWorks(works.works.filter((work) => work.status === "approved")),
    sources: works.sources ?? {},
  };
}

function dedupeWorks(works: WorkItem[]) {
  const deduped = new Map<string, WorkItem>();

  for (const work of works) {
    deduped.set(buildWorkIdentity(work), mergeWork(deduped.get(buildWorkIdentity(work)), work));
  }

  return Array.from(deduped.values()).sort(sortWorks);
}

function mergeWork(existing: WorkItem | undefined, incoming: WorkItem) {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    viewCount: Math.max(existing.viewCount ?? 0, incoming.viewCount ?? 0),
    likeCount: Math.max(existing.likeCount ?? 0, incoming.likeCount ?? 0),
    favoriteCount: Math.max(existing.favoriteCount ?? 0, incoming.favoriteCount ?? 0),
    commentCount: Math.max(existing.commentCount ?? 0, incoming.commentCount ?? 0),
    clickCount: Math.max(existing.clickCount ?? 0, incoming.clickCount ?? 0),
    heatScore: Math.max(existing.heatScore ?? 0, incoming.heatScore ?? 0),
  };
}

function buildWorkIdentity(work: WorkItem) {
  return normalizeWorkUrl(work.externalUrl || work.githubUrl || work.videoUrl || work.id);
}

function normalizeWorkUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function sortWorks(left: WorkItem, right: WorkItem) {
  return (
    Number(right.featured) - Number(left.featured) ||
    (right.heatScore ?? 0) - (left.heatScore ?? 0) ||
    new Date(right.publishedAt ?? right.createdAt).getTime() -
      new Date(left.publishedAt ?? left.createdAt).getTime()
  );
}

function buildFallbackWorks(): GeneratedWorks {
  return {
    updatedAt: "2026-05-25T00:00:00.000Z",
    works: interestingWorks,
    sources: {
      mock: {
        ok: true,
        count: interestingWorks.length,
        fetchedAt: "2026-05-25T00:00:00.000Z",
      },
    },
  };
}
