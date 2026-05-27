import { XMLParser } from "fast-xml-parser";

import type { AiSource } from "@/lib/ai-sources";
import {
  cleanTitleText,
  countTailNoiseIndicators,
  extractArticleBlocksFromHtml,
  extractArticleTextFromHtml,
  normalizeArticleText,
  stripHtmlToText,
} from "@/lib/article-cleaner";
import type { ArticleContentBlock } from "@/lib/mock-data";
import { buildProductionPostCopy } from "@/lib/post-insights";
import { isRelevantAiContent } from "@/lib/source-relevance";

export type SourceItem = {
  sourceId: string;
  sourceName: string;
  title: string;
  url?: string;
  coverImageUrl?: string;
  imageUrls?: string[];
  contentBlocks?: ArticleContentBlock[];
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
  if (source.fetchType === "html") {
    return fetchHtmlSourceItems(source, limit);
  }

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

async function fetchHtmlSourceItems(source: AiSource, limit: number): Promise<SourceItem[]> {
  const pageUrl = source.feedUrl ?? source.homeUrl;
  const response = await fetchWithRetry(pageUrl, {
    headers: {
      "user-agent":
        process.env.AIQ_USER_AGENT ??
        "AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`${source.name} returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const candidateCount = Math.max(limit * 8, limit);
  const normalizedItems = extractHtmlListItems(source, html, pageUrl)
    .slice(0, candidateCount)
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
  const url = extractLink(item);
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
    url,
    coverImageUrl: extractFeedImageUrl(item, url),
    imageUrls: extractFeedImageUrls(item, url),
    contentBlocks: extractFeedContentBlocks(item, title, url),
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
  const keywordMatched =
    includeKeywords.length === 0
      ? true
      : includeKeywords.some((keyword) => titleAndBody.includes(keyword.toLowerCase()));

  if (!keywordMatched) return false;

  return isRelevantAiContent(source, item);
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

function extractHtmlListItems(source: AiSource, html: string, pageUrl: string): SourceItem[] {
  const linkMatches = Array.from(
    html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  );
  const seen = new Set<string>();
  const items: SourceItem[] = [];

  for (const match of linkMatches) {
    const url = absolutizeUrl(stripHtmlToText(match[1]), pageUrl);
    if (!url || seen.has(url)) continue;
    if (!isLikelyArticleUrl(url)) continue;

    const title = cleanTitleText(stripHtmlToText(match[2]));
    if (title.length < 8) continue;

    seen.add(url);
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      title,
      url,
      coverImageUrl: extractNearbyImageUrl(html, match.index ?? 0, pageUrl),
      imageUrls: [],
      contentBlocks: [],
      summary: title,
      content: title,
      tags: source.tags,
    });
  }

  return items;
}

function isLikelyArticleUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)ithome\.com$/i.test(url.hostname) && /\/\d+\/\d+\/\d+\.htm$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function extractNearbyImageUrl(html: string, index: number, pageUrl: string) {
  const start = Math.max(0, index - 900);
  const end = Math.min(html.length, index + 900);
  return extractImageUrlsFromHtml(html.slice(start, end))
    .map((url) => absolutizeUrl(url, pageUrl))
    .find((url): url is string => Boolean(url));
}

function extractFeedImageUrl(item: RawFeedItem, articleUrl?: string) {
  return extractFeedImageUrls(item, articleUrl)[0];
}

function extractFeedImageUrls(item: RawFeedItem, articleUrl?: string) {
  const candidates = [
    readMediaUrl(item["media:content"]),
    readMediaUrl(item["media:thumbnail"]),
    readMediaUrl(item.enclosure),
    ...extractImageUrlsFromHtml(
      [
        asText(item.description),
        asText(item.summary),
        asText(item.content),
        asText(item["content:encoded"]),
      ].join(" "),
    ),
  ].map((url) => absolutizeUrl(url, articleUrl));

  return uniqueImageUrls(candidates);
}

function extractFeedContentBlocks(item: RawFeedItem, title: string, articleUrl?: string) {
  const html = [
    asText(item.description),
    asText(item.summary),
    asText(item.content),
    asText(item["content:encoded"]),
  ]
    .filter(Boolean)
    .join("\n");

  if (!html) return [];
  return extractArticleBlocksFromHtml(html, title, articleUrl);
}

async function hydrateSourceItemContent(source: AiSource, item: SourceItem) {
  if (!item.url) return item;
  if (shouldSkipHtmlHydration(source, item)) return finalizeSourceItem(item);

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
    const fullText = extractArticleTextFromHtml(html, item.title, item.url);
    const contentBlocks = extractArticleBlocksFromHtml(html, item.title, item.url);
    const content = selectRicherText(item.content, fullText);
    const htmlImageUrls = extractHtmlImageUrls(html, item.url);
    const imageUrls = uniqueImageUrls([...(item.imageUrls ?? []), ...htmlImageUrls]);
    const coverImageUrl = item.coverImageUrl || imageUrls[0] || extractHtmlImageUrl(html, item.url);

    return finalizeSourceItem({
      ...item,
      coverImageUrl,
      imageUrls,
      contentBlocks: contentBlocks.length ? contentBlocks : item.contentBlocks,
      content,
      summary: clipText(content || item.summary, 260),
      tags: Array.from(new Set([...item.tags, ...extractHtmlKeywords(html)])).slice(0, 8),
    });
  } catch {
    return finalizeSourceItem(item);
  }
}

async function finalizeSourceItem(item: SourceItem): Promise<SourceItem> {
  const copy = await buildProductionPostCopy({
    title: item.title,
    rawContent: item.content || item.summary,
    fallbackSummary: item.summary,
    sourceName: item.sourceName,
    tags: item.tags,
  });

  return {
    ...item,
    summary: copy.summary,
    content: copy.content,
  };
}

function selectRicherText(currentText: string, nextText: string) {
  const currentNoise = countTailNoiseIndicators(currentText);
  const nextNoise = countTailNoiseIndicators(nextText);

  if (nextText && nextNoise < currentNoise) return nextText;
  return nextText.length > currentText.length + 80 ? nextText : currentText;
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

function extractHtmlImageUrl(html: string, pageUrl?: string) {
  return extractHtmlImageUrls(html, pageUrl)[0];
}

function extractHtmlImageUrls(html: string, pageUrl?: string) {
  const candidates = [
    readMetaContent(html, "property", "og:image"),
    readMetaContent(html, "name", "twitter:image"),
    readMetaContent(html, "property", "twitter:image"),
    ...extractImageUrlsFromHtml(html),
  ].map((url) => absolutizeUrl(url, pageUrl));

  return uniqueImageUrls(candidates);
}

function readMetaContent(html: string, attrName: "name" | "property", attrValue: string) {
  const metaTagPattern = /<meta\b[^>]*>/gi;
  const attrPattern = new RegExp(
    `${attrName}=["']${escapeRegExp(attrValue)}["']|content=["']([^"']+)["']`,
    "gi",
  );

  for (const tagMatch of html.matchAll(metaTagPattern)) {
    const tag = tagMatch[0];
    if (!new RegExp(`${attrName}=["']${escapeRegExp(attrValue)}["']`, "i").test(tag)) continue;

    attrPattern.lastIndex = 0;
    for (const attrMatch of tag.matchAll(attrPattern)) {
      if (attrMatch[1]) return stripHtmlToText(attrMatch[1]);
    }
  }

  return "";
}

function readMediaUrl(value: unknown): string | undefined {
  const entries = toArray(value);

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const medium = asText(record["@_medium"]).toLowerCase();
    const type = asText(record["@_type"]).toLowerCase();
    const url = asText(record["@_url"]) || asText(record.url) || asText(record["@_href"]);

    if (!url) continue;
    if (medium && medium !== "image") continue;
    if (type && !type.startsWith("image/")) continue;

    return url;
  }

  return undefined;
}

function extractImageUrlsFromHtml(html: string) {
  const matches = Array.from(
    html.matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi),
  );
  const urls: string[] = [];

  for (const match of matches) {
    const imageUrl = stripHtmlToText(match[1]);
    if (isUsableArticleImage(imageUrl)) urls.push(imageUrl);
  }

  return urls;
}

function absolutizeUrl(value: string | undefined, pageUrl?: string) {
  if (!value) return undefined;
  if (!pageUrl) return value;

  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

function isUsableArticleImage(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (/^(data:|blob:)/i.test(value)) return false;
  if (/\.(svg|gif)(\?|#|$)/i.test(value)) return false;
  if (/staticx\.36krcdn\.com\/36kr-web\/static\//i.test(normalized)) return false;
  if (/\/36kr-web\/static\//i.test(normalized)) return false;
  if (
    /(avatar|logo|icon|sprite|wechat|qrcode|qr-code|barcode|placeholder|default|head\.jpg)/i.test(
      normalized,
    )
  ) {
    return false;
  }
  if (/(^|\/)\d{2,4}-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)(\?|#|$)/i.test(normalized)) {
    return false;
  }
  if (/(^|\/)\d{2,4}x\d{2,4}\.(jpe?g|png|webp)(\?|#|$)/i.test(normalized)) {
    return false;
  }
  if (/(qbitai[-_]?logo|qbitai_icon|qrcode_qbitai)/i.test(normalized)) return false;
  if (/(logo_|logowhite|code_production|dailyplanet|jingzhun|krspace|aly\.|bytey\.|gaodi\.|getui\.|ftnn\.|renren@2x|lingke\.)/i.test(normalized)) {
    return false;
  }
  return /^https?:\/\//i.test(value) || value.startsWith("//") || value.startsWith("/");
}

function uniqueImageUrls(urls: Array<string | undefined>) {
  const seen = new Set<string>();

  return urls.filter((url): url is string => {
    if (!isUsableArticleImage(url)) return false;
    const normalized = url.replace(/^http:\/\//i, "https://");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldSkipHtmlHydration(source: AiSource, item: SourceItem) {
  if (!item.url) return false;

  // 36kr 快讯页正文里常混入站点静态素材和导航内容，直接使用 RSS 摘要更稳。
  return source.id === "kr36-ai" && /36kr\.com\/newsflashes\//i.test(item.url);
}
