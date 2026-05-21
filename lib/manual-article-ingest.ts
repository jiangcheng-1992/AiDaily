import { XMLParser } from "fast-xml-parser";

import { type AiSource, authoritativeSources } from "@/lib/ai-sources";
import {
  cleanTitleText,
  countTailNoiseIndicators,
  decodeHtmlEntities,
  extractArticleBlocksFromHtml,
  extractArticleTextFromHtml,
  normalizeArticleText,
  stripHtmlToText,
} from "@/lib/article-cleaner";
import { generateProductionAiComments } from "@/lib/ai-comment-service";
import { buildGeneratedPostCopy } from "@/lib/post-insights";
import { buildGeneratedPostId } from "@/lib/post-identity";
import { isRelevantAiContent } from "@/lib/source-relevance";
import type { ArticleContentBlock, Comment, Post } from "@/lib/mock-data";

type ManualIngestResult = {
  source: AiSource;
  post: Post;
  comments: Comment[];
};

type HtmlMetadata = {
  title?: string;
  publishedAt?: string;
  author?: string;
  canonicalUrl?: string;
  coverImageUrl?: string;
  imageUrls?: string[];
  contentBlocks?: ArticleContentBlock[];
  keywords: string[];
  content: string;
};

type RawFeedItem = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export async function ingestArticleByUrl(rawUrl: string): Promise<ManualIngestResult> {
  const normalizedInputUrl = normalizeUrl(rawUrl);
  const source = resolveSourceByUrl(normalizedInputUrl);

  if (!source) {
    throw new Error("暂不支持这个来源，请先把它加入 AI 信息源列表");
  }

  const sourceCandidate = await findSourceItemByUrl(source, normalizedInputUrl);
  const htmlMetadata = await fetchArticleMetadataWithFallback(normalizedInputUrl, Boolean(sourceCandidate));
  const sourceUrl = sourceCandidate?.url ?? htmlMetadata.canonicalUrl ?? normalizedInputUrl;
  const rawContent = pickPreferredContent(sourceCandidate?.content ?? "", htmlMetadata.content);
  const copy = buildGeneratedPostCopy({
    title: sourceCandidate?.title || htmlMetadata.title || normalizedInputUrl,
    rawContent,
    fallbackSummary: sourceCandidate?.summary || htmlMetadata.content || rawContent,
  });
  const publishedAt = toIsoDate(sourceCandidate?.publishedAt ?? htmlMetadata.publishedAt);
  const collectedAt = new Date().toISOString();
  const tags = uniqueTags([
    ...source.tags,
    ...(sourceCandidate?.tags ?? []),
    ...htmlMetadata.keywords,
    authorityLabel(source.authority),
  ]).slice(0, 8);
  const candidateTitle = sourceCandidate?.title || htmlMetadata.title || normalizedInputUrl;
  const relevant = isRelevantAiContent(source, {
    title: candidateTitle,
    summary: sourceCandidate?.summary || htmlMetadata.content || copy.summary,
    content: copy.content,
    tags,
    url: sourceUrl,
  });

  if (!relevant) {
    throw new Error("内容与 AI 相关性不足，已跳过");
  }

  const post: Post = {
    id: buildGeneratedPostId({
      sourceId: source.id,
      sourceUrl,
      title: candidateTitle || copy.summary || normalizedInputUrl,
      type: source.recommendedType,
    }),
    sourceId: source.id,
    type: source.recommendedType,
    title: candidateTitle,
    summary: copy.summary,
    content: copy.content,
    whyItMatters: copy.whyItMatters,
    editorComment: copy.editorComment,
    sourceName: source.name,
    sourceUrl,
    coverImageUrl: sourceCandidate?.coverImageUrl || htmlMetadata.coverImageUrl,
    imageUrls: uniqueImageUrls([
      ...(sourceCandidate?.imageUrls ?? []),
      ...(htmlMetadata.imageUrls ?? []),
    ]),
    contentBlocks:
      htmlMetadata.contentBlocks?.length || sourceCandidate?.contentBlocks?.length
        ? [...(htmlMetadata.contentBlocks ?? sourceCandidate?.contentBlocks ?? [])]
        : undefined,
    author: htmlMetadata.author,
    tags,
    createdAt: publishedAt || collectedAt,
    collectedAt,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
  };
  const commentResult = await generateProductionAiComments({ post });
  const comments = commentResult.comments;

  return {
    source,
    post,
    comments,
  };
}

async function findSourceItemByUrl(source: AiSource, rawUrl: string) {
  if (!source.feedUrl) return null;

  try {
    const response = await fetchWithRetry(source.feedUrl, {
      headers: buildRequestHeaders("application/rss+xml, application/atom+xml, application/xml, text/xml"),
    });

    if (!response.ok) return null;

    const xml = await response.text();
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const rawItems = extractRawItems(parsed);

    for (const item of rawItems) {
      const candidateUrl = extractLink(item);
      if (!candidateUrl || !isSameArticleUrl(candidateUrl, rawUrl)) continue;

      const content = normalizeArticleText(
        (asText(item.description) ||
          asText(item.summary) ||
          asText(item.content) ||
          asText(item["content:encoded"]) ||
          "")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<\/li>/gi, "\n"),
      );

      return {
        title: cleanTitleText(asText(item.title)),
        url: candidateUrl,
        summary: content,
        content,
        publishedAt:
          asText(item.pubDate) ||
          asText(item.published) ||
          asText(item.updated) ||
          asText(item.date) ||
          undefined,
        coverImageUrl: extractFeedImageUrl(item),
        imageUrls: extractFeedImageUrls(item),
        contentBlocks: extractFeedContentBlocks(item, cleanTitleText(asText(item.title)), candidateUrl),
        tags: [
          ...source.tags,
          ...toArray(item.category).map((entry) => stripHtmlToText(asText(entry))).filter(Boolean),
        ],
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchArticleMetadataWithFallback(rawUrl: string, allowEmptyFallback: boolean) {
  try {
    return await fetchArticleMetadata(rawUrl);
  } catch (error) {
    if (!allowEmptyFallback) {
      throw error;
    }

    return {
      keywords: [],
      content: "",
    } satisfies HtmlMetadata;
  }
}

async function fetchArticleMetadata(rawUrl: string): Promise<HtmlMetadata> {
  const response = await fetchWithRetry(rawUrl, {
    headers: buildRequestHeaders("text/html,application/xhtml+xml"),
  });

  if (!response.ok) {
    throw new Error(`文章页面返回 HTTP ${response.status}`);
  }

  const html = await response.text();
  const skipHtmlBody = shouldSkipHtmlBodyExtraction(rawUrl);

  return {
    title:
      readMetaContent(html, "property", "og:title") ||
      readMetaContent(html, "name", "title") ||
      readFirstHeading(html) ||
      readTitleTag(html),
    publishedAt:
      readMetaContent(html, "property", "article:published_time") ||
      readMetaContent(html, "name", "publishdate") ||
      readMetaContent(html, "name", "pubdate") ||
      readDatePublishedFromJsonLd(html),
    author:
      readMetaContent(html, "name", "author") ||
      readMetaContent(html, "property", "article:author") ||
      undefined,
    canonicalUrl:
      readLinkHref(html, "canonical") ||
      readMetaContent(html, "property", "og:url") ||
      undefined,
    coverImageUrl:
      (!skipHtmlBody ? extractHtmlImageUrl(html, rawUrl) : undefined) ||
      undefined,
    imageUrls: skipHtmlBody ? [] : extractHtmlImageUrls(html, rawUrl),
    contentBlocks: skipHtmlBody ? [] : extractArticleBlocksFromHtml(html, readFirstHeading(html) || readTitleTag(html), rawUrl),
    keywords: extractHtmlKeywords(html),
    content: skipHtmlBody
      ? ""
      : extractArticleTextFromHtml(
          html,
          readFirstHeading(html) || readTitleTag(html),
          rawUrl,
        ),
  };
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

function resolveSourceByUrl(rawUrl: string) {
  const inputUrl = new URL(rawUrl);

  return authoritativeSources.find((source) => {
    const homeUrl = safeParseUrl(source.homeUrl);
    const feedUrl = source.feedUrl ? safeParseUrl(source.feedUrl) : null;

    return (
      sameHostname(inputUrl, homeUrl) ||
      sameHostname(inputUrl, feedUrl) ||
      inputUrl.hostname.includes(stripWww(homeUrl?.hostname ?? ""))
    );
  });
}

function buildRequestHeaders(accept: string) {
  return {
    "user-agent":
      process.env.AIQ_USER_AGENT ?? "AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)",
    accept,
  };
}

function readMetaContent(html: string, attrName: "name" | "property", attrValue: string) {
  const match = html.match(
    new RegExp(
      `<meta[^>]+${attrName}=["']${escapeRegExp(attrValue)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
  );

  return decodeHtmlEntities(match?.[1] ?? "").trim();
}

function readTitleTag(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtmlToText(match?.[1] ?? "");
}

function readLinkHref(html: string, rel: string) {
  const match = html.match(
    new RegExp(`<link[^>]+rel=["']${escapeRegExp(rel)}["'][^>]+href=["']([^"']+)["'][^>]*>`, "i"),
  );

  return decodeHtmlEntities(match?.[1] ?? "").trim();
}

function readDatePublishedFromJsonLd(html: string) {
  const jsonLdBlocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );

  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      const records = Array.isArray(parsed) ? parsed : [parsed];

      for (const record of records) {
        const datePublished = findStringProperty(record, "datePublished");
        if (datePublished) return datePublished;
      }
    } catch {
      continue;
    }
  }

  return "";
}

function findStringProperty(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringProperty(entry, key);
      if (found) return found;
    }

    return "";
  }

  const record = value as Record<string, unknown>;
  if (typeof record[key] === "string") return record[key] as string;

  for (const entry of Object.values(record)) {
    const found = findStringProperty(entry, key);
    if (found) return found;
  }

  return "";
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

function extractFeedImageUrl(item: RawFeedItem) {
  return extractFeedImageUrls(item)[0];
}

function extractFeedImageUrls(item: RawFeedItem) {
  const articleUrl = extractLink(item);
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

function extractHtmlImageUrl(html: string, pageUrl?: string) {
  return extractHtmlImageUrls(html, pageUrl)[0];
}

function extractHtmlImageUrls(html: string, pageUrl?: string) {
  const candidates = [
    ...extractImageUrlsFromHtml(html),
    readMetaContent(html, "property", "og:image"),
    readMetaContent(html, "name", "twitter:image"),
    readMetaContent(html, "property", "twitter:image"),
  ].map((url) => absolutizeUrl(url, pageUrl));

  return uniqueImageUrls(candidates);
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

function pickPreferredContent(feedContent: string, htmlContent: string) {
  const cleanFeedContent = feedContent.trim();
  const cleanHtmlContent = htmlContent.trim();

  if (!cleanFeedContent) return cleanHtmlContent;
  if (!cleanHtmlContent) return cleanFeedContent;
  if (countTailNoiseIndicators(cleanHtmlContent) < countTailNoiseIndicators(cleanFeedContent)) {
    return cleanHtmlContent;
  }
  if (cleanHtmlContent.length > cleanFeedContent.length * 0.7) return cleanHtmlContent;

  return cleanFeedContent;
}

function sameHostname(left: URL, right: URL | null) {
  if (!right) return false;
  return stripWww(left.hostname) === stripWww(right.hostname);
}

function stripWww(hostname: string) {
  return hostname.replace(/^www\./i, "");
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value: string) {
  return new URL(value).toString();
}

function isSameArticleUrl(left: string, right: string) {
  const leftUrl = safeParseUrl(left);
  const rightUrl = safeParseUrl(right);

  if (!leftUrl || !rightUrl) return false;

  return (
    stripWww(leftUrl.hostname) === stripWww(rightUrl.hostname) &&
    leftUrl.pathname.replace(/\/$/, "") === rightUrl.pathname.replace(/\/$/, "")
  );
}

function authorityLabel(authority: AiSource["authority"]) {
  const labels: Record<AiSource["authority"], string> = {
    official: "官方源",
    research: "研究源",
    media: "媒体源",
    community: "社区源",
    product: "产品源",
  };

  return labels[authority];
}

function uniqueTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

function toIsoDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readFirstHeading(html: string) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return stripHtmlToText(match?.[1] ?? "");
}

function shouldSkipHtmlBodyExtraction(rawUrl: string) {
  return /36kr\.com\/newsflashes\//i.test(rawUrl);
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
