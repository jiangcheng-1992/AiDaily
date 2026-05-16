import { XMLParser } from "fast-xml-parser";

import type { AiSource } from "@/lib/ai-sources";

export type SourceItem = {
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  summary: string;
  publishedAt?: string;
  tags: string[];
};

type RawFeedItem = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export async function fetchSourceItems(
  source: AiSource,
  limit = 8,
): Promise<SourceItem[]> {
  if (!source.feedUrl) return [];

  const response = await fetchWithRetry(source.feedUrl, {
    headers: {
      "user-agent":
        process.env.AIQ_USER_AGENT ??
        "AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`${source.name} returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const rawItems = extractRawItems(parsed);

  return rawItems
    .slice(0, limit)
    .map((item) => normalizeFeedItem(source, item))
    .filter(hasRequiredFeedFields);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 2,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) break;
      await delay(350 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

function extractRawItems(parsed: unknown): RawFeedItem[] {
  const feed = parsed as Record<string, unknown>;
  const rss = feed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const item = channel?.item;

  if (item) return toArray(item) as RawFeedItem[];

  const atom = feed.feed as Record<string, unknown> | undefined;
  if (atom?.entry) return toArray(atom.entry) as RawFeedItem[];

  return [];
}

function normalizeFeedItem(source: AiSource, item: RawFeedItem): SourceItem {
  const title = stripHtml(asText(item.title)) || "未命名内容";
  const summary = stripHtml(
    asText(item.description) ||
      asText(item.summary) ||
      asText(item.content) ||
      asText(item["content:encoded"]) ||
      "",
  );
  const publishedAt =
    asText(item.pubDate) ||
    asText(item.published) ||
    asText(item.updated) ||
    asText(item.date);

  return {
    sourceId: source.id,
    sourceName: source.name,
    title,
    url: extractLink(item),
    summary: summary.slice(0, 260),
    publishedAt,
    tags: source.tags.slice(0, 5),
  };
}

function extractLink(item: RawFeedItem) {
  const link = item.link;

  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alternate = link.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as Record<string, unknown>;
      return record["@_rel"] === "alternate" || !record["@_rel"];
    });

    if (alternate && typeof alternate === "object") {
      return asText((alternate as Record<string, unknown>)["@_href"]);
    }
  }
  if (link && typeof link === "object") {
    return asText((link as Record<string, unknown>)["@_href"]);
  }

  return asText(item.guid) || asText(item.id);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"]) || asText(record["@_href"]);
  }
  return "";
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [value];
}

function hasRequiredFeedFields(item: SourceItem) {
  return Boolean(item.title && item.url);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
