import { XMLParser } from "fast-xml-parser";

import type { AiSource } from "@/lib/ai-sources";
import {
  cleanTitleText,
  extractArticleTextFromHtml,
  normalizeArticleText,
  stripHtmlToText,
} from "@/lib/article-cleaner";
import { buildGeneratedPostCopy } from "@/lib/post-insights";

export type SourceItem = {
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  summary: string;
  content: string;
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

  const candidateCount = Math.max(limit * 6, limit);
  const normalizedItems = rawItems
    .slice(0, candidateCount)
    .map((item) => normalizeFeedItem(source, item))
    .filter((item) => hasRequiredFeedFields(item) && isFreshEnough(item, source));

  const hydratedItems = await Promise.all(
    normalizedItems.map((item) => hydrateSourceItemContent(source, item)),
  );

  return hydratedItems.filter((item) => matchesSourceKeywords(item, source)).slice(0, limit);
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
  const title = cleanTitleText(asText(item.title)) || "未命名内容";
  const content = normalizeArticleText(
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
    summary: clipText(content, 260),
    content,
    publishedAt,
    tags: Array.from(new Set([...source.tags, ...extractCategories(item)])).slice(0, 6),
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

function matchesSourceKeywords(item: SourceItem, source: AiSource) {
  const titleAndBody = `${item.title} ${item.summary} ${item.content}`.toLowerCase().trim();
  const haystack = `${titleAndBody} ${item.tags.join(" ")} ${item.url ?? ""}`.toLowerCase().trim();

  if (!haystack) return true;

  const excludeKeywords = source.excludeKeywords?.filter(Boolean) ?? [];
  if (excludeKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    return false;
  }

  const includeKeywords = source.includeKeywords?.filter(Boolean) ?? [];
  if (includeKeywords.length === 0) return true;

  return includeKeywords.some((keyword) => titleAndBody.includes(keyword.toLowerCase()));
}

function isFreshEnough(item: SourceItem, source: AiSource) {
  if (!item.publishedAt || !source.maxItemAgeDays) return true;

  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return true;

  const maxAgeMs = source.maxItemAgeDays * 24 * 60 * 60 * 1000;
  return Date.now() - publishedAt.getTime() <= maxAgeMs;
}

function extractCategories(item: RawFeedItem) {
  return toArray(item.category)
    .map((entry) => stripHtmlToText(asText(entry)))
    .filter(Boolean);
}

async function hydrateSourceItemContent(source: AiSource, item: SourceItem) {
  if (!item.url) return item;

  try {
    const response = await fetchWithRetry(item.url, {
      headers: {
        "user-agent":
          process.env.AIQ_USER_AGENT ??
          "AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return finalizeSourceItem(item);

    const html = await response.text();
    const fullText = extractArticleTextFromHtml(html, item.title);
    const content = selectRicherText(item.content, fullText);

    return finalizeSourceItem({
      ...item,
      content,
      summary: clipText(content || item.summary, 260),
      tags: Array.from(new Set([...item.tags, ...extractHtmlKeywords(html)])).slice(0, 8),
    });
  } catch {
    return finalizeSourceItem(item);
  }
}

function finalizeSourceItem(item: SourceItem): SourceItem {
  const copy = buildGeneratedPostCopy({
    title: item.title,
    rawContent: item.content || item.summary,
    fallbackSummary: item.summary,
  });

  return {
    ...item,
    summary: copy.summary,
    content: copy.content,
  };
}

function selectRicherText(currentText: string, nextText: string) {
  return nextText.length > currentText.length + 80 ? nextText : currentText;
}

function extractArticleText(html: string) {
  const articleMatch =
    html.match(/<article[\s\S]*?<\/article>/i) ??
    html.match(/<main[\s\S]*?<\/main>/i) ??
    html.match(/<body[\s\S]*?<\/body>/i);
  const block = articleMatch?.[0] ?? html;

  return normalizeArticleText(
    block
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n"),
  );
}

function extractHtmlKeywords(html: string) {
  const keywords = html.match(
    /<meta[^>]+(?:name|property)=["'](?:keywords|article:tag)["'][^>]+content=["']([^"']+)["']/gi,
  );

  return (keywords ?? [])
    .flatMap((entry) => {
      const match = entry.match(/content=["']([^"']+)["']/i);
      return (match?.[1] ?? "").split(/[，,]/);
    })
    .map((keyword) => stripHtmlToText(keyword))
    .filter(Boolean);
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
