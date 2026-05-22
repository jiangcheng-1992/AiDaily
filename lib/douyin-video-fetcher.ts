import {
  type DouyinVideoSource,
  autoIngestDouyinVideoSources,
  douyinVideoSources,
} from "@/lib/douyin-video-sources";
import { normalizeTags } from "@/lib/utils";

export type DouyinVideoItem = {
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  videoUrl?: string;
  videoEmbedUrl?: string;
  coverImageUrl?: string;
  durationMs?: number;
  author?: string;
  publishedAt?: string;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  hotScore: number;
  tags: string[];
  profileUrl: string;
};

type DouyinAwemeResponse = {
  aweme_list?: DouyinAweme[];
  status_code?: number;
  has_more?: number;
  max_cursor?: number;
};

type DouyinAweme = {
  aweme_id: string;
  desc?: string;
  create_time?: number;
  share_url?: string;
  statistics?: {
    digg_count?: number;
    comment_count?: number;
    collect_count?: number;
  };
  author?: {
    nickname?: string;
  };
  video?: {
    duration?: number;
    cover?: { url_list?: string[] };
    dynamic_cover?: { url_list?: string[] };
    origin_cover?: { url_list?: string[] };
    play_addr?: { url_list?: string[] };
  };
};

type SeoVideoObject = {
  "@type"?: string;
  name?: string;
  description?: string;
  thumbnailUrl?: string | string[];
  uploadDate?: string;
  duration?: string;
  creator?: {
    name?: string;
    url?: string;
  };
  commentCount?: number | string;
};

const DOUYIN_HEADERS = {
  "user-agent":
    process.env.AIQ_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  referer: "https://www.douyin.com/",
  accept: "application/json, text/plain, */*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};
const DOUYIN_SPIDER_HEADERS = {
  "user-agent":
    process.env.AIQ_DOUYIN_SPIDER_UA ??
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": DOUYIN_HEADERS["accept-language"],
};

const VIDEO_TITLE_KEYWORDS = [
  "AI",
  "人工智能",
  "大模型",
  "模型",
  "Agent",
  "智能体",
  "机器人",
  "OpenAI",
  "Anthropic",
  "Claude",
  "ChatGPT",
  "字节",
  "Google",
  "谷歌",
  "Meta",
  "腾讯",
  "阿里",
  "华为",
  "李飞飞",
  "马斯克",
  "黄仁勋",
];

const VIDEO_EVENT_KEYWORDS = [
  "发布",
  "开源",
  "上线",
  "推出",
  "升级",
  "官宣",
  "获投",
  "融资",
  "回应",
  "更新",
  "争议",
  "读懂",
  "翻译",
  "蒸馏",
  "量产",
  "评测",
  "首发",
  "突破",
  "发布会",
];

const CAPTION_NOISE_PATTERNS = [
  /#前沿科技趋势发布月/gi,
  /#AI新星计划/gi,
  /#AI[^\s#]*/g,
  /网友[:：][^。！？!\n]+/g,
  /（来源[:：][^)]*）/g,
  /\(来源[:：][^)]*\)/g,
];

const MAX_VIDEO_AGE_DAYS = 90;
const DOUYIN_HOME_URL = "https://www.douyin.com/";

export async function fetchDouyinVideoItems({
  sourceLimit = 6,
  itemLimit = 2,
}: {
  sourceLimit?: number;
  itemLimit?: number;
}) {
  const sources = autoIngestDouyinVideoSources.slice(0, sourceLimit);
  const results: Array<{
    source: DouyinVideoSource;
    ok: boolean;
    count: number;
    items: DouyinVideoItem[];
    error?: string;
  }> = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await fetchSourceVideos(source, itemLimit);
        results.push({
          source,
          ok: true,
          count: items.length,
          items,
        });
      } catch (error) {
        results.push({
          source,
          ok: false,
          count: 0,
          items: [],
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),
  );

  return results.sort((a, b) => a.source.name.localeCompare(b.source.name));
}

export async function fetchDouyinVideoSourceItems(
  source: DouyinVideoSource,
  itemLimit = 2,
): Promise<DouyinVideoItem[]> {
  return fetchSourceVideos(source, itemLimit);
}

export async function refreshDouyinVideoItemByUrl({
  sourceId,
  sourceUrl,
}: {
  sourceId?: string;
  sourceUrl?: string;
}) {
  const normalizedUrl = sourceUrl?.trim();
  const videoId = normalizedUrl ? extractDouyinVideoId(normalizedUrl) : undefined;
  console.info("[douyin-refresh] start", {
    sourceId: sourceId ?? null,
    sourceUrl: normalizedUrl ?? null,
    videoId: videoId ?? null,
  });

  if (!normalizedUrl || !videoId) {
    console.warn("[douyin-refresh] missing normalizedUrl or videoId", {
      sourceId: sourceId ?? null,
      sourceUrl: normalizedUrl ?? null,
      videoId: videoId ?? null,
    });
    return null;
  }

  const source =
    douyinVideoSources.find((item) => item.id === sourceId) ??
    douyinVideoSources.find((item) => normalizedUrl.includes(item.secUserId)) ??
    null;

  console.info("[douyin-refresh] source resolved", {
    sourceId: source?.id ?? null,
    sourceName: source?.name ?? null,
    matchedBy: source?.id === sourceId ? "sourceId" : source ? "secUserId" : "none",
    videoId,
  });

  if (source) {
    try {
      const awemes = await fetchSourceAwemes(source.secUserId, 18);
      const matched = awemes.find((aweme) => aweme.aweme_id === videoId);
      const freshItem = matched ? normalizeDouyinAweme(source, matched) : null;
      console.info("[douyin-refresh] author feed lookup completed", {
        sourceId: source.id,
        sourceName: source.name,
        awemeCount: awemes.length,
        matchedAweme: Boolean(matched),
        hasVideoUrl: Boolean(freshItem?.videoUrl),
        hasVideoEmbedUrl: Boolean(freshItem?.videoEmbedUrl),
      });
      if (freshItem?.videoUrl || freshItem?.videoEmbedUrl) {
        console.info("[douyin-refresh] author feed produced usable item", {
          sourceId: source.id,
          sourceName: source.name,
          videoId,
          hasVideoUrl: Boolean(freshItem.videoUrl),
          hasVideoEmbedUrl: Boolean(freshItem.videoEmbedUrl),
        });
        return freshItem;
      }
    } catch (error) {
      console.warn("[douyin-refresh] author feed lookup failed", {
        sourceId: source.id,
        sourceName: source.name,
        videoId,
        error: formatErrorMessage(error),
      });
      // Fall back to SEO parsing when the author feed API is temporarily unavailable.
    }

    try {
      const seoItem = await fetchSeoVideoItem(source, normalizedUrl);
      console.info("[douyin-refresh] seo fallback completed", {
        sourceId: source.id,
        sourceName: source.name,
        videoId,
        hasVideoUrl: Boolean(seoItem?.videoUrl),
        hasVideoEmbedUrl: Boolean(seoItem?.videoEmbedUrl),
      });
      return seoItem;
    } catch (error) {
      console.warn("[douyin-refresh] seo fallback failed", {
        sourceId: source.id,
        sourceName: source.name,
        videoId,
        error: formatErrorMessage(error),
      });
      return null;
    }
  }

  console.warn("[douyin-refresh] no source matched, returning share-page fallback", {
    sourceId: sourceId ?? null,
    sourceUrl: normalizedUrl,
    videoId,
  });
  return {
    sourceId: sourceId ?? "douyin-runtime-refresh",
    sourceName: "抖音视频",
    title: "",
    summary: "",
    content: "",
    url: buildDouyinVideoUrl(videoId),
    videoEmbedUrl: buildMobileDouyinShareUrl(videoId),
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
    hotScore: 0,
    tags: [],
    profileUrl: "",
  };
}

async function fetchSourceVideos(
  source: DouyinVideoSource,
  itemLimit: number,
): Promise<DouyinVideoItem[]> {
  const candidateCount = Math.min(Math.max(itemLimit * 12, 18), 36);
  try {
    const awemes = await fetchSourceAwemes(source.secUserId, candidateCount);
    return awemes
      .map((aweme) => normalizeDouyinAweme(source, aweme))
      .filter(isDouyinVideoItem)
      .filter(isFreshVideoItem)
      .filter((item) => matchesKeywords(item, source))
      .sort(compareDouyinVideoItems)
      .slice(0, itemLimit);
  } catch (error) {
    return fetchSourceVideosFromSeoPages(source, itemLimit, error);
  }
}

async function fetchSourceVideosFromSeoPages(
  source: DouyinVideoSource,
  itemLimit: number,
  originalError: unknown,
): Promise<DouyinVideoItem[]> {
  const seoVideoUrls = await fetchSeoVideoUrls(source);
  const candidateUrls = seoVideoUrls.slice(0, Math.max(itemLimit * 8, 16));

  if (!candidateUrls.length) {
    throw new Error(
      `Douyin SEO fallback found no video links after API error: ${formatErrorMessage(originalError)}`,
    );
  }

  const settled = await Promise.allSettled(
    candidateUrls.map((url) => fetchSeoVideoItem(source, url)),
  );
  const items = settled
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter((item): item is DouyinVideoItem => Boolean(item))
    .filter(isFreshVideoItem)
    .filter((item) => matchesKeywords(item, source))
    .sort(compareDouyinVideoItems)
    .slice(0, itemLimit);

  if (items.length > 0) {
    return items;
  }

  throw new Error(
    `Douyin SEO fallback produced no usable videos from ${candidateUrls.length} links after API error: ${formatErrorMessage(
      originalError,
    )}`,
  );
}

async function fetchSourceAwemes(secUserId: string, candidateCount: number) {
  const pageSize = Math.min(Math.max(candidateCount, 12), 18);
  const awemes: DouyinAweme[] = [];
  let cursor = 0;
  const cookie = await getDouyinCookie();

  for (let page = 0; page < 3 && awemes.length < candidateCount; page += 1) {
    const endpoint = new URL("https://www.douyin.com/aweme/v1/web/aweme/post/");
    endpoint.searchParams.set("device_platform", "webapp");
    endpoint.searchParams.set("sec_user_id", secUserId);
    endpoint.searchParams.set("channel", "channel_pc_web");
    endpoint.searchParams.set("count", String(pageSize));
    endpoint.searchParams.set("max_cursor", String(cursor));
    endpoint.searchParams.set("aid", "6383");
    endpoint.searchParams.set("pc_client_type", "1");
    endpoint.searchParams.set("version_code", "190600");
    endpoint.searchParams.set("version_name", "19.6.0");
    endpoint.searchParams.set("cookie_enabled", "true");
    endpoint.searchParams.set("platform", "PC");
    endpoint.searchParams.set("downlink", "10");
    endpoint.searchParams.set("effective_type", "4g");
    endpoint.searchParams.set("round_trip_time", "50");
    endpoint.searchParams.set("browser_language", "zh-CN");
    endpoint.searchParams.set("browser_platform", "Win32");
    endpoint.searchParams.set("browser_name", "Chrome");
    endpoint.searchParams.set("browser_version", "136.0.0.0");
    endpoint.searchParams.set("browser_online", "true");
    endpoint.searchParams.set("engine_name", "Blink");
    endpoint.searchParams.set("engine_version", "136.0.0.0");
    endpoint.searchParams.set("os_name", "Windows");
    endpoint.searchParams.set("os_version", "10");
    endpoint.searchParams.set("cpu_core_num", "8");
    endpoint.searchParams.set("device_memory", "8");
    endpoint.searchParams.set("screen_width", "1440");
    endpoint.searchParams.set("screen_height", "900");

    const response = await fetch(endpoint, {
      headers: {
        ...DOUYIN_HEADERS,
        cookie,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Douyin returned HTTP ${response.status}`);
    }

    const rawText = await response.text();
    if (!rawText.trim()) {
      throw new Error("Douyin returned empty body");
    }

    const data = safeParseDouyinJson(rawText);
    if (data.status_code && data.status_code !== 0) {
      throw new Error(`Douyin returned status_code=${data.status_code}`);
    }

    awemes.push(...(data.aweme_list ?? []));

    if (!data.has_more || typeof data.max_cursor !== "number" || data.max_cursor === cursor) {
      break;
    }

    cursor = data.max_cursor;
  }

  return awemes.slice(0, candidateCount);
}

async function getDouyinCookie() {
  try {
    const response = await fetch(DOUYIN_HOME_URL, {
      headers: {
        "user-agent": DOUYIN_HEADERS["user-agent"],
        accept: "text/html,application/xhtml+xml",
        "accept-language": DOUYIN_HEADERS["accept-language"],
      },
      cache: "no-store",
    });
    const setCookie = response.headers.get("set-cookie") ?? "";
    const ttwid = extractCookie(setCookie, "ttwid");
    const msToken = extractCookie(setCookie, "msToken");
    return [ttwid ? `ttwid=${ttwid}` : "", msToken ? `msToken=${msToken}` : ""]
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

async function fetchSeoVideoUrls(source: DouyinVideoSource) {
  const profileUrls = [
    source.profileUrl,
    `https://www.iesdouyin.com/share/user/${source.secUserId}`,
  ];
  const settled = await Promise.allSettled(profileUrls.map((url) => fetchDouyinSeoHtml(url)));
  const urls = settled.flatMap((result) =>
    result.status === "fulfilled" ? extractVideoUrlsFromSeoHtml(result.value) : [],
  );

  return Array.from(new Set(urls));
}

async function fetchSeoVideoItem(
  source: DouyinVideoSource,
  videoUrl: string,
): Promise<DouyinVideoItem | null> {
  const html = await fetchDouyinSeoHtml(videoUrl);
  const meta = extractMetaTags(html);
  const seoVideo = extractSeoVideoObject(html);
  const rawTitle = decodeHtmlEntities(
    seoVideo?.name || meta["lark:url:video_title"] || meta["og:title"] || "",
  ).replace(/\s*-\s*抖音$/, "");
  const rawDescription = decodeHtmlEntities(
    seoVideo?.description || meta.description || meta["og:description"] || rawTitle,
  );
  const caption = sanitizeCaptionText(normalizeCaption(rawTitle || rawDescription));
  const normalizedDescription = stripSeoDescriptionTail(rawDescription);
  const title = buildVideoTitle(caption || normalizedDescription || rawTitle, source);
  const summary = normalizedDescription || caption || title;
  const coverImageUrl = normalizeSeoCoverUrl(
    meta["lark:url:video_cover_image_url"],
    seoVideo?.thumbnailUrl,
  );
  const videoEmbedUrl = normalizeSeoEmbedUrl(meta["lark:url:video_iframe_url"], videoUrl);
  const videoId = extractDouyinVideoId(videoUrl);
  const publishedAt = toIsoDate(seoVideo?.uploadDate);
  const likesCount = 0;
  const commentsCount = parseSeoCount(seoVideo?.commentCount);
  const savesCount = 0;
  const durationMs = parseIsoDurationMs(seoVideo?.duration);
  const author = decodeHtmlEntities(seoVideo?.creator?.name || source.name.replace(/^抖音 · /, ""));

  if (!title) return null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    title,
    summary: buildVideoSummary(summary, title),
    content: summary || title,
    url: videoId ? buildDouyinVideoUrl(videoId) : videoUrl,
    videoEmbedUrl,
    coverImageUrl,
    durationMs,
    author,
    publishedAt,
    likesCount,
    commentsCount,
    savesCount,
    hotScore: computeVideoHotScore({
      likesCount,
      commentsCount,
      savesCount,
      publishedAt,
    }),
    tags: buildVideoTags(`${rawTitle} ${summary}`.trim(), source.tags),
    profileUrl: seoVideo?.creator?.url || source.profileUrl,
  };
}

function extractVideoUrlsFromSeoHtml(html: string) {
  const absoluteDouyinUrls = Array.from(
    html.matchAll(/https:\/\/www\.douyin\.com\/video\/\d+/g),
  ).map((match) => match[0]);
  const absoluteShareUrls = Array.from(
    html.matchAll(/https:\/\/www\.iesdouyin\.com\/share\/video\/\d+/g),
  ).map((match) => match[0]);
  const relativeDouyinUrls = Array.from(html.matchAll(/\/video\/\d+/g)).map(
    (match) => `https://www.douyin.com${match[0]}`,
  );
  const relativeShareUrls = Array.from(html.matchAll(/\/share\/video\/\d+/g)).map(
    (match) => `https://www.iesdouyin.com${match[0]}`,
  );

  return [
    ...relativeDouyinUrls,
    ...relativeShareUrls,
    ...absoluteDouyinUrls,
    ...absoluteShareUrls,
  ];
}

async function fetchDouyinSeoHtml(url: string) {
  const response = await fetch(url, {
    headers: DOUYIN_SPIDER_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Douyin SEO fallback returned HTTP ${response.status}`);
  }

  return response.text();
}

function extractMetaTags(html: string) {
  const tags: Record<string, string> = {};
  const regex = /<meta[^>]+(?:name|property)="([^"]+)"[^>]+content="([^"]*)"/g;

  for (const match of html.matchAll(regex)) {
    tags[match[1]] = decodeHtmlEntities(match[2]);
  }

  return tags;
}

function extractSeoVideoObject(html: string) {
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  );

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as SeoVideoObject;
      if (parsed?.["@type"] === "VideoObject") {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function safeParseDouyinJson(rawText: string): DouyinAwemeResponse {
  try {
    return JSON.parse(rawText) as DouyinAwemeResponse;
  } catch {
    throw new Error(`Douyin returned non-JSON body: ${rawText.slice(0, 120)}`);
  }
}

function extractCookie(setCookieHeader: string, cookieName: string) {
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? "";
}

function normalizeDouyinAweme(
  source: DouyinVideoSource,
  aweme: DouyinAweme,
): DouyinVideoItem | null {
  const rawCaption = normalizeCaption(aweme.desc ?? "");
  const caption = sanitizeCaptionText(rawCaption);
  const title = buildVideoTitle(caption, source);
  const url = aweme.aweme_id
    ? buildDouyinVideoUrl(aweme.aweme_id)
    : canonicalizeDouyinVideoUrl(aweme.share_url?.trim());
  const videoUrl = aweme.video?.play_addr?.url_list?.[0]?.trim();
  const coverImageUrl = pickDouyinCoverUrl(aweme.video);

  if (!title || !url) return null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    title,
    summary: buildVideoSummary(caption, title),
    content: caption || title,
    url,
    videoUrl,
    videoEmbedUrl: buildDouyinEmbedUrl(aweme.aweme_id),
    coverImageUrl,
    durationMs: aweme.video?.duration,
    author: aweme.author?.nickname || source.name.replace(/^抖音 · /, ""),
    publishedAt: aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined,
    likesCount: aweme.statistics?.digg_count ?? 0,
    commentsCount: aweme.statistics?.comment_count ?? 0,
    savesCount: aweme.statistics?.collect_count ?? 0,
    hotScore: computeHotScore(aweme),
    tags: buildVideoTags(rawCaption, source.tags),
    profileUrl: source.profileUrl,
  };
}

function isDouyinVideoItem(item: DouyinVideoItem | null): item is DouyinVideoItem {
  return Boolean(item);
}

function normalizeCaption(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+#/g, " #")
    .trim();
}

function sanitizeCaptionText(value: string) {
  return CAPTION_NOISE_PATTERNS.reduce((text, pattern) => text.replace(pattern, " "), value)
    .replace(/#[^\s#]+/g, " ")
    .replace(/^(刚刚|重磅|居然|竟然|太猛了|太炸了)\s*[：:，,]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVideoTitle(caption: string, source: DouyinVideoSource) {
  const clauses = splitHeadlineClauses(caption);
  const ranked = clauses
    .map((clause) => rewriteHeadlineClause(clause))
    .filter((clause) => clause.length >= 8)
    .map((clause) => ({
      clause,
      score: scoreHeadlineClause(clause, source),
    }))
    .sort((left, right) => right.score - left.score || right.clause.length - left.clause.length);

  const primary = ranked[0]?.clause || clauses[0] || caption;
  const secondary = ranked.find((entry) => !isSameHeadlineClause(entry.clause, primary))?.clause;
  let title = primary;

  if (secondary && shouldAppendContext(primary)) {
    title = `${primary}：${secondary}`;
  }

  title = finalizeHeadline(title, source);
  return clipTitle(title, 46);
}

function buildVideoSummary(caption: string, title: string) {
  const normalized = caption.replace(/\n/g, " ").trim();
  if (!normalized) return title;
  if (normalized.startsWith(title)) return normalized.slice(0, 140);
  return normalized.slice(0, 140);
}

function buildVideoTags(caption: string, defaultTags: string[]) {
  const hashtagMatches = Array.from(caption.matchAll(/#([^\s#]+)/g)).map((match) => match[1]);
  return Array.from(new Set([...defaultTags, ...normalizeTags(hashtagMatches.join(" "))])).slice(0, 8);
}

function computeHotScore(aweme: DouyinAweme) {
  const likes = aweme.statistics?.digg_count ?? 0;
  const comments = aweme.statistics?.comment_count ?? 0;
  const saves = aweme.statistics?.collect_count ?? 0;
  const publishedAt = aweme.create_time ? new Date(aweme.create_time * 1000).toISOString() : undefined;

  return computeVideoHotScore({
    likesCount: likes,
    commentsCount: comments,
    savesCount: saves,
    publishedAt,
  });
}

function compareDouyinVideoItems(left: DouyinVideoItem, right: DouyinVideoItem) {
  if (right.hotScore !== left.hotScore) return right.hotScore - left.hotScore;
  if (right.likesCount !== left.likesCount) return right.likesCount - left.likesCount;

  return (
    new Date(right.publishedAt ?? 0).getTime() -
    new Date(left.publishedAt ?? 0).getTime()
  );
}

function isFreshVideoItem(item: DouyinVideoItem) {
  if (!item.publishedAt) return true;

  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return true;

  const ageMs = Date.now() - publishedAt.getTime();
  return ageMs <= MAX_VIDEO_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function splitHeadlineClauses(value: string) {
  return value
    .split(/[\n。！？!?；;]+|(?<=，)|(?<=,)/)
    .map((clause) => clause.trim().replace(/[，,]$/, ""))
    .filter(Boolean);
}

function rewriteHeadlineClause(value: string) {
  return value
    .replace(/^(但|不过|其实|另外|还有)\s*/, "")
    .replace(/大神程序员/g, "程序员")
    .replace(/拿了(\d+(?:\.\d+)?)个亿/g, "获投$1亿元")
    .replace(/拿了(\d+(?:\.\d+)?)亿/g, "获投$1亿元")
    .replace(/把自己蒸馏了/g, "把经验蒸馏成可复用 skill")
    .replace(/像刷抖音一样玩游戏/g, "一句话即可生成游戏")
    .replace(/瞎写代码/g, "乱写代码")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHeadlineClause(value: string, source: DouyinVideoSource) {
  let score = 0;

  if (value.length >= 10 && value.length <= 34) score += 5;
  if (value.length > 34 && value.length <= 48) score += 3;
  if (/[0-9一二三四五六七八九十百千万亿]/.test(value)) score += 2;
  if (VIDEO_EVENT_KEYWORDS.some((keyword) => value.includes(keyword))) score += 5;
  if (VIDEO_TITLE_KEYWORDS.some((keyword) => value.includes(keyword))) score += 4;
  if (source.tags.some((tag) => tag && value.includes(tag.replace(/^AI视频$/, "")))) score += 1;
  if (/^(为什么|如何|到底|这波|这次|真相)/.test(value)) score -= 2;
  if (/网友|必备|太猛|太炸|疯了|绝了/.test(value)) score -= 3;

  return score;
}

function shouldAppendContext(value: string) {
  if (value.length < 14) return true;
  return !VIDEO_EVENT_KEYWORDS.some((keyword) => value.includes(keyword));
}

function finalizeHeadline(value: string, source: DouyinVideoSource) {
  const normalized = value
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/([A-Za-z]+)\s+([A-Za-z]+)/g, "$1 $2")
    .trim();

  if (VIDEO_EVENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return normalized;
  }

  const sourceName = source.name.replace(/^抖音 · /, "");
  return `${sourceName}：${normalized}`;
}

function isSameHeadlineClause(left: string, right: string) {
  return normalizeHeadlineCompare(left) === normalizeHeadlineCompare(right);
}

function normalizeHeadlineCompare(value: string) {
  return value.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function clipTitle(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;
}

function computeVideoHotScore({
  likesCount,
  commentsCount,
  savesCount,
  publishedAt,
}: {
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  publishedAt?: string;
}) {
  const publishedAtMs = publishedAt ? new Date(publishedAt).getTime() : Date.now();
  const safePublishedAtMs = Number.isNaN(publishedAtMs) ? Date.now() : publishedAtMs;
  const ageHours = Math.max(1, (Date.now() - safePublishedAtMs) / (1000 * 60 * 60));
  const engagement = likesCount + commentsCount * 18 + savesCount * 24;
  const decay = Math.pow(Math.max(ageHours, 6), 0.42);

  return Math.round(engagement / decay);
}

function parseSeoCount(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return 0;

  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseIsoDurationMs(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);

  if (!match) return undefined;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
}

function toIsoDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeSeoCoverUrl(metaCover?: string, thumbnailUrl?: string | string[]) {
  const raw =
    metaCover ||
    (Array.isArray(thumbnailUrl) ? thumbnailUrl.find(Boolean) : thumbnailUrl) ||
    "";

  return normalizeDouyinAssetUrl(raw);
}

function normalizeSeoEmbedUrl(metaEmbedUrl: string | undefined, videoUrl: string) {
  if (metaEmbedUrl) {
    return decodeHtmlEntities(metaEmbedUrl);
  }

  const videoId = extractDouyinVideoId(videoUrl);
  return videoId ? buildDouyinEmbedUrl(videoId) : undefined;
}

function buildDouyinVideoUrl(videoId: string) {
  return `https://www.douyin.com/video/${videoId}`;
}

function buildDouyinEmbedUrl(videoId: string) {
  return buildMobileDouyinShareUrl(videoId);
}

function buildMobileDouyinShareUrl(videoId: string) {
  return `https://m.douyin.com/share/video/${videoId}`;
}

function extractDouyinVideoId(value: string) {
  const pathMatch = value.match(/\/(?:share\/)?video\/(\d+)/)?.[1];
  if (pathMatch) return pathMatch;

  try {
    const url = new URL(value);
    return (
      url.searchParams.get("modal_id") ||
      url.searchParams.get("aweme_id") ||
      url.searchParams.get("item_id") ||
      url.searchParams.get("object_id") ||
      url.searchParams.get("video_id") ||
      undefined
    );
  } catch {
    return value.match(/(?:modal_id|aweme_id|item_id|object_id|video_id)=(\d+)/)?.[1];
  }
}

function canonicalizeDouyinVideoUrl(value?: string) {
  if (!value) return "";
  const videoId = extractDouyinVideoId(value);
  return videoId ? buildDouyinVideoUrl(videoId) : value;
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function stripSeoDescriptionTail(value: string) {
  return value
    .replace(/\s*-\s*[^-]{1,40}于\d{8}发布在抖音.*$/u, "")
    .replace(/来抖音，记录美好生活！?$/u, "")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function pickDouyinCoverUrl(video?: DouyinAweme["video"]) {
  return normalizeDouyinAssetUrl(
    video?.origin_cover?.url_list?.find(Boolean) ||
      video?.cover?.url_list?.find(Boolean) ||
      video?.dynamic_cover?.url_list?.find(Boolean),
  );
}

function normalizeDouyinAssetUrl(value?: string) {
  if (!value) return undefined;

  const decoded = decodeHtmlEntities(value).trim();
  if (!decoded) return undefined;
  if (decoded.startsWith("//")) return `https:${decoded}`;
  return decoded;
}

function matchesKeywords(item: DouyinVideoItem, source: DouyinVideoSource) {
  const haystack = `${item.title} ${item.summary} ${item.content}`.toLowerCase();
  const excludeKeywords = source.excludeKeywords ?? [];
  if (excludeKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    return false;
  }

  const includeKeywords = source.includeKeywords ?? [];
  if (!includeKeywords.length) return true;

  return includeKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
