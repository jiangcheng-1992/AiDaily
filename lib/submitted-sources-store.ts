import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type SubmittedSourceKind = "rss" | "website" | "douyin" | "bilibili" | "youtube";

export type SubmittedSource = {
  id: string;
  kind: SubmittedSourceKind;
  name: string;
  url: string;
  status: "active" | "error";
  submittedByUserId: string;
  submittedByEmail: string;
  submittedAt: string;
  lastFetchedAt?: string;
  lastError?: string;
  lastPostCount?: number;
};

type SubmittedSourcesStore = {
  sources: SubmittedSource[];
};

const emptyStore: SubmittedSourcesStore = {
  sources: [],
};

export function getSubmittedSourcesPath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "submitted-sources.json");
}

export async function readSubmittedSources(): Promise<SubmittedSourcesStore> {
  const filePath = getSubmittedSourcesPath();
  if (!existsSync(filePath)) return emptyStore;

  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<SubmittedSourcesStore>;
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return emptyStore;
  }
}

export async function upsertSubmittedSource(source: SubmittedSource) {
  const store = await readSubmittedSources();
  const normalizedUrl = normalizeSourceUrl(source.url);
  const existingIndex = store.sources.findIndex(
    (item) => item.kind === source.kind && normalizeSourceUrl(item.url) === normalizedUrl,
  );
  const nextSources =
    existingIndex >= 0
      ? store.sources.map((item, index) => (index === existingIndex ? { ...item, ...source } : item))
      : [source, ...store.sources];

  await writeSubmittedSources({ sources: nextSources });
  return existingIndex >= 0 ? nextSources[existingIndex] : source;
}

export function createSubmittedSourceId(kind: SubmittedSourceKind, url: string) {
  if (typeof randomUUID === "function") return `submitted-${kind}-${randomUUID()}`;
  return `submitted-${kind}-${createHash("sha1").update(`${kind}:${url}`).digest("hex").slice(0, 12)}`;
}

export function normalizeSourceUrl(url: string) {
  return url.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
}

async function writeSubmittedSources(store: SubmittedSourcesStore) {
  const filePath = getSubmittedSourcesPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}
