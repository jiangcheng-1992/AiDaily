import { type DouyinVideoSource, autoIngestDouyinVideoSources } from "@/lib/douyin-video-sources";
import { normalizeTags } from "@/lib/utils";

export type DouyinVideoItem = {
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  videoUrl?: string;
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

const DOUYIN_HEADERS = {
  "user-agent":
    process.env.AIQ_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  referer: "https://www.douyin.com/",
  accept: "application/json, text/plain, */*",
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

async function fetchSourceVideos(
  source: DouyinVideoSource,
  itemLimit: number,
): Promise<DouyinVideoItem[]> {
  const candidateCount = Math.min(Math.max(itemLimit * 12, 18), 36);
  const awemes = await fetchSourceAwemes(source.secUserId, candidateCount);
  const items = awemes
    .map((aweme) => normalizeDouyinAweme(source, aweme))
    .filter(isDouyinVideoItem)
    .filter(isFreshVideoItem)
    .filter((item) => matchesKeywords(item, source))
    .sort(compareDouyinVideoItems)
    .slice(0, itemLimit);

  return items;
}

async function fetchSourceAwemes(secUserId: string, candidateCount: number) {
  const pageSize = Math.min(Math.max(candidateCount, 12), 18);
  const awemes: DouyinAweme[] = [];
  let cursor = 0;

  for (let page = 0; page < 3 && awemes.length < candidateCount; page += 1) {
    const endpoint = new URL("https://www.douyin.com/aweme/v1/web/aweme/post/");
    endpoint.searchParams.set("sec_user_id", secUserId);
    endpoint.searchParams.set("count", String(pageSize));
    endpoint.searchParams.set("max_cursor", String(cursor));
    endpoint.searchParams.set("aid", "6383");

    const response = await fetch(endpoint, {
      headers: DOUYIN_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Douyin returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as DouyinAwemeResponse;
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

function normalizeDouyinAweme(
  source: DouyinVideoSource,
  aweme: DouyinAweme,
): DouyinVideoItem | null {
  const rawCaption = normalizeCaption(aweme.desc ?? "");
  const caption = sanitizeCaptionText(rawCaption);
  const title = buildVideoTitle(caption, source);
  const url = aweme.share_url?.trim();
  const videoUrl = aweme.video?.play_addr?.url_list?.[0]?.trim();
  const coverImageUrl =
    aweme.video?.dynamic_cover?.url_list?.[0]?.trim() ||
    aweme.video?.cover?.url_list?.[0]?.trim() ||
    aweme.video?.origin_cover?.url_list?.[0]?.trim();

  if (!title || !url) return null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    title,
    summary: buildVideoSummary(caption, title),
    content: caption || title,
    url,
    videoUrl,
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
  const publishedAtMs = aweme.create_time ? aweme.create_time * 1000 : Date.now();
  const ageHours = Math.max(1, (Date.now() - publishedAtMs) / (1000 * 60 * 60));
  const engagement = likes + comments * 18 + saves * 24;
  const decay = Math.pow(Math.max(ageHours, 6), 0.42);

  return Math.round(engagement / decay);
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
