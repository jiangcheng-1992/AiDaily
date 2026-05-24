import { XMLParser } from "fast-xml-parser";

import {
  autoIngestBackupVideoSources,
  type BackupVideoSource,
} from "@/lib/backup-video-sources";
import type { DouyinVideoItem } from "@/lib/douyin-video-fetcher";
import { stripHtmlToText } from "@/lib/article-cleaner";

type RawFeedItem = Record<string, unknown>;

export type BackupVideoFetchResult = {
  source: BackupVideoSource;
  ok: boolean;
  count: number;
  items: DouyinVideoItem[];
  error?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export async function fetchBackupVideoItems({
  sourceLimit = 6,
  itemLimit = 2,
}: {
  sourceLimit?: number;
  itemLimit?: number;
} = {}): Promise<BackupVideoFetchResult[]> {
  const sources = autoIngestBackupVideoSources.slice(0, sourceLimit);
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const items = await fetchBackupVideoSourceItems(source, itemLimit);
      return {
        source,
        ok: true,
        count: items.length,
        items,
      };
    }),
  );

  return results.map((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") return result.value;

    return {
      source,
      ok: false,
      count: 0,
      items: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown backup video error",
    };
  });
}

export async function fetchSingleBackupVideoSource(
  source: BackupVideoSource,
  itemLimit = 2,
): Promise<DouyinVideoItem[]> {
  return fetchBackupVideoSourceItems(source, itemLimit);
}

async function fetchBackupVideoSourceItems(
  source: BackupVideoSource,
  limit: number,
): Promise<DouyinVideoItem[]> {
  if (source.platform === "bilibili") {
    return fetchBilibiliVideoItems(source, limit);
  }

  if (source.feedUrl.startsWith("rsshub://")) {
    throw new Error("RSSHUB_BASE_URL is required for Bilibili backup video sources");
  }

  const response = await fetchWithTimeout(source.feedUrl);
  if (!response.ok) {
    throw new Error(`${source.name} returned HTTP ${response.status}`);
  }

  const xml = await response.text();
  const rawItems = extractRawItems(parser.parse(xml)).slice(0, Math.max(limit * 4, limit));

  return rawItems
    .map((item) => normalizeBackupVideoItem(source, item))
    .filter((item): item is DouyinVideoItem => Boolean(item))
    .filter((item) => isFreshEnough(item, source))
    .filter((item) => matchesKeywords(item, source))
    .slice(0, limit);
}

async function fetchBilibiliVideoItems(
  source: BackupVideoSource,
  limit: number,
): Promise<DouyinVideoItem[]> {
  const apiItems = source.bilibiliKeyword
    ? await fetchBilibiliSearchItems(source.bilibiliKeyword, limit)
    : source.bilibiliMid
      ? await fetchBilibiliSpaceItems(source.bilibiliMid, limit)
      : [];

  const normalizedItems = apiItems
    .map((item) => normalizeBilibiliApiItem(source, item))
    .filter((item): item is DouyinVideoItem => Boolean(item))
    .filter((item) => isFreshEnough(item, source))
    .filter((item) => matchesKeywords(item, source))
    .slice(0, limit);

  if (normalizedItems.length > 0) return normalizedItems;

  if (!source.feedUrl.startsWith("rsshub://")) {
    const response = await fetchWithTimeout(source.feedUrl);
    if (!response.ok) throw new Error(`${source.name} RSS fallback returned HTTP ${response.status}`);

    const xml = await response.text();
    return extractRawItems(parser.parse(xml))
      .map((item) => normalizeBackupVideoItem(source, item))
      .filter((item): item is DouyinVideoItem => Boolean(item))
      .filter((item) => isFreshEnough(item, source))
      .filter((item) => matchesKeywords(item, source))
      .slice(0, limit);
  }

  throw new Error(`${source.name} returned no Bilibili videos`);
}

async function fetchBilibiliSearchItems(keyword: string, limit: number): Promise<BilibiliApiItem[]> {
  const url = new URL("https://api.bilibili.com/x/web-interface/search/type");
  url.searchParams.set("search_type", "video");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("order", "pubdate");
  url.searchParams.set("page", "1");

  const json = await fetchBilibiliJson(url.toString(), `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`);
  const items = toArray((json.data as Record<string, unknown> | undefined)?.result) as Record<
    string,
    unknown
  >[];

  return items.slice(0, Math.max(limit * 4, limit)).map((item) => ({
    bvid: asText(item.bvid),
    title: stripHtmlToText(asText(item.title)),
    description: stripHtmlToText(asText(item.description)),
    pic: normalizeBilibiliImageUrl(asText(item.pic)),
    author: stripHtmlToText(asText(item.author)),
    duration: asText(item.duration),
    created: Number(item.pubdate),
    play: Number(item.play),
    review: Number(item.review),
    favorites: Number(item.favorites),
  }));
}

async function fetchBilibiliSpaceItems(mid: string, limit: number): Promise<BilibiliApiItem[]> {
  const url = new URL("https://api.bilibili.com/x/space/arc/search");
  url.searchParams.set("mid", mid);
  url.searchParams.set("ps", String(Math.max(limit * 3, limit)));
  url.searchParams.set("pn", "1");
  url.searchParams.set("order", "pubdate");
  url.searchParams.set("jsonp", "jsonp");

  const json = await fetchBilibiliJson(url.toString(), `https://space.bilibili.com/${mid}`);
  const data = json.data as Record<string, unknown> | undefined;
  const list = data?.list as Record<string, unknown> | undefined;
  return (toArray(list?.vlist) as Record<string, unknown>[]).map((item) => ({
    bvid: asText(item.bvid),
    title: stripHtmlToText(asText(item.title)),
    description: stripHtmlToText(asText(item.description)),
    pic: normalizeBilibiliImageUrl(asText(item.pic)),
    author: stripHtmlToText(asText(item.author)),
    duration: asText(item.length) || asText(item.duration),
    created: Number(item.created),
    play: Number(item.play),
    review: Number(item.comment),
    favorites: Number(item.favorites),
  }));
}

async function fetchBilibiliJson(url: string, referer: string) {
  const response = await fetchWithTimeout(url, {
    referer,
    accept: "application/json, text/plain, */*",
  });
  const json = (await response.json()) as {
    code?: number;
    message?: string;
    data?: unknown;
  };

  if (!response.ok) throw new Error(`Bilibili returned HTTP ${response.status}`);
  if (json.code !== 0) {
    throw new Error(`Bilibili returned code ${json.code}: ${json.message ?? "unknown error"}`);
  }

  return json;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent":
          process.env.AIQ_USER_AGENT ??
          "AIQ/1.0 (+https://github.com/jiangcheng-1992/AiDaily)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

type BilibiliApiItem = {
  bvid: string;
  title: string;
  description: string;
  pic?: string;
  author?: string;
  duration?: string;
  created?: number;
  play?: number;
  review?: number;
  favorites?: number;
};

function normalizeBilibiliApiItem(
  source: BackupVideoSource,
  item: BilibiliApiItem,
): DouyinVideoItem | null {
  if (!item.bvid || !item.title) return null;

  const sourceUrl = `https://www.bilibili.com/video/${item.bvid}`;
  const description = normalizeText(item.description);

  return {
    sourceId: source.id,
    sourceName: source.name,
    title: item.title,
    summary: clipText(description || `${source.name} 发布了新视频：${item.title}`, 180),
    content:
      `${description || item.title}\n\n` +
      `原视频：${sourceUrl}\n\n` +
      "备用视频源：B站。抖音抓取异常时，AI圈会用 B站/YouTube 公开视频源补位，保证视频内容不断流。",
    url: sourceUrl,
    videoEmbedUrl: buildEmbedUrl("bilibili", item.bvid),
    coverImageUrl: item.pic,
    durationMs: parseVideoDurationMs(item.duration),
    author: item.author || source.name.replace(/^B站 · /, ""),
    publishedAt: item.created ? new Date(item.created * 1000).toISOString() : undefined,
    likesCount: toSafeNumber(item.play),
    commentsCount: toSafeNumber(item.review),
    savesCount: toSafeNumber(item.favorites),
    hotScore: toSafeNumber(item.play),
    tags: source.tags,
    profileUrl: source.profileUrl,
  };
}

function normalizeBilibiliImageUrl(value: string) {
  if (!value) return undefined;
  if (value.startsWith("//")) return `https:${value}`;
  return value.replace(/^http:\/\//i, "https://");
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function extractRawItems(parsed: unknown): RawFeedItem[] {
  const feed = parsed as Record<string, unknown>;
  const rss = feed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel?.item) return toArray(channel.item) as RawFeedItem[];

  const atom = feed.feed as Record<string, unknown> | undefined;
  if (atom?.entry) return toArray(atom.entry) as RawFeedItem[];

  return [];
}

function normalizeBackupVideoItem(
  source: BackupVideoSource,
  item: RawFeedItem,
): DouyinVideoItem | null {
  const title = asText(item.title).trim();
  const url = extractLink(item);
  if (!title || !url) return null;

  const mediaGroup = item["media:group"] as Record<string, unknown> | undefined;
  const description = normalizeText(
    asText(mediaGroup?.["media:description"]) ||
      asText(item.description) ||
      asText(item.summary) ||
      asText(item["content:encoded"]),
  );
  const publishedAt =
    asText(item.published) || asText(item.pubDate) || asText(item.updated) || asText(item.date);
  const videoId = extractVideoId(url, source.platform) || asText(item["yt:videoId"]);
  const coverImageUrl =
    readMediaUrl(mediaGroup?.["media:thumbnail"]) ||
    readMediaUrl(item["media:thumbnail"]) ||
    (source.platform === "youtube" && videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : undefined);
  const sourceUrl = normalizeSourceUrl(url, source.platform, videoId);
  const durationMs =
    readMediaDurationMs(mediaGroup?.["media:content"]) ||
    readMediaDurationMs(item["media:content"]) ||
    parseVideoDurationMs(asText(item["itunes:duration"]) || asText(item.duration));

  return {
    sourceId: source.id,
    sourceName: source.name,
    title,
    summary: clipText(description || `${source.name} 发布了新视频：${title}`, 180),
    content:
      `${description || title}\n\n` +
      `原视频：${sourceUrl}\n\n` +
      `备用视频源：${source.name}。当抖音抓取失败时，AI圈会用 YouTube/B站等公开视频源补位，保证视频内容不断流。`,
    url: sourceUrl,
    videoEmbedUrl: buildEmbedUrl(source.platform, videoId),
    coverImageUrl,
    durationMs,
    author: source.name.replace(/^(YouTube|B站) · /, ""),
    publishedAt,
    likesCount: readNumber(mediaGroup?.["media:community"], "media:statistics", "@_views"),
    commentsCount: 0,
    savesCount: 0,
    hotScore: readNumber(mediaGroup?.["media:community"], "media:statistics", "@_views"),
    tags: source.tags,
    profileUrl: source.profileUrl,
  };
}

function normalizeText(value: string) {
  return stripHtmlToText(value).replace(/\s+/g, " ").trim();
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
    return alternate && typeof alternate === "object"
      ? asText((alternate as Record<string, unknown>)["@_href"])
      : "";
  }
  if (link && typeof link === "object") {
    return asText((link as Record<string, unknown>)["@_href"]);
  }

  return asText(item.guid) || asText(item.id);
}

function buildEmbedUrl(platform: BackupVideoSource["platform"], videoId: string) {
  if (!videoId) return undefined;
  if (platform === "youtube") return `https://www.youtube.com/embed/${videoId}`;
  if (platform === "bilibili") return `https://player.bilibili.com/player.html?bvid=${videoId}`;
  return undefined;
}

function normalizeSourceUrl(
  url: string,
  platform: BackupVideoSource["platform"],
  videoId: string,
) {
  if (platform === "youtube" && videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  if (platform === "bilibili" && videoId) return `https://www.bilibili.com/video/${videoId}`;
  return url;
}

function extractVideoId(url: string, platform: BackupVideoSource["platform"]) {
  if (platform === "youtube") {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("v") ?? parsed.pathname.match(/\/shorts\/([^/?#]+)/)?.[1] ?? "";
    } catch {
      return url.match(/[?&]v=([^&#]+)/)?.[1] ?? "";
    }
  }

  return url.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] ?? url.match(/\b(BV[a-zA-Z0-9]+)\b/)?.[1] ?? "";
}

function isFreshEnough(item: DouyinVideoItem, source: BackupVideoSource) {
  if (!item.publishedAt || !source.maxItemAgeDays) return true;

  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return true;

  return Date.now() - publishedAt.getTime() <= source.maxItemAgeDays * 24 * 60 * 60 * 1000;
}

function matchesKeywords(item: DouyinVideoItem, source: BackupVideoSource) {
  const keywords = source.includeKeywords?.filter(Boolean) ?? [];
  if (keywords.length === 0) return true;

  const haystack = `${item.title} ${item.summary} ${item.content} ${item.tags.join(" ")}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function readMediaUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readMediaUrl).find(Boolean);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["@_url"]) || asText(record.url) || asText(record["@_href"]) || undefined;
  }
  return undefined;
}

function readMediaDurationMs(value: unknown): number | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map(readMediaDurationMs).find((duration): duration is number => Boolean(duration));
  }
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  return parseVideoDurationMs(
    asText(record["@_duration"]) ||
      asText(record.duration) ||
      asText(record["@_yt:duration"]),
  );
}

function parseVideoDurationMs(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return value > 1000 ? Math.round(value) : Math.round(value * 1000);
  }

  const raw = String(value).trim();
  if (!raw) return undefined;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1000 ? Math.round(numeric) : Math.round(numeric * 1000);
  }

  const parts = raw.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.length >= 2 && parts.length <= 3 && parts.every((part) => Number.isFinite(part))) {
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  const isoMatch = raw.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0);
    const minutes = Number(isoMatch[2] ?? 0);
    const seconds = Number(isoMatch[3] ?? 0);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds * 1000 : undefined;
  }

  return undefined;
}

function readNumber(root: unknown, childKey: string, attrKey: string) {
  if (!root || typeof root !== "object") return 0;
  const child = (root as Record<string, unknown>)[childKey];
  if (!child || typeof child !== "object") return 0;
  const parsed = Number((child as Record<string, unknown>)[attrKey]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"]) || asText(record["@_href"]) || asText(record["@_url"]);
  }
  return "";
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [value];
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}
