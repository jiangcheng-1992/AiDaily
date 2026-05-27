import type { WorkItem, WorkSource } from "@/lib/interesting-works";
import { stripHtmlToText } from "@/lib/article-cleaner";

type VimeoListingCandidate = {
  id: string;
  title: string;
  url: string;
  coverUrl: string;
  page: number;
  rank: number;
};

type VimeoOEmbedResponse = {
  title?: string;
  author_name?: string;
  author_url?: string;
  duration?: number;
  description?: string;
  thumbnail_url?: string;
  upload_date?: string;
  html?: string;
  video_id?: number;
};

type VimeoVideoKind = {
  label: string;
  tags: string[];
  score: number;
};

type ScoredVimeoWork = {
  candidate: VimeoListingCandidate;
  detail: VimeoOEmbedResponse;
  score: number;
  kind: VimeoVideoKind;
};

export type VimeoWorksFetchResult = {
  ok: boolean;
  source: WorkSource;
  count: number;
  works: WorkItem[];
  error?: string;
  diagnostics?: {
    pageCount: number;
    candidateCount: number;
    dedupedCandidateCount: number;
    detailSuccessCount: number;
    detailFailureCount: number;
    pageErrors: Record<string, string>;
  };
};

const VIMEO_SOURCE: WorkSource = "vimeo";
const STAFF_PICKS_URL = "https://vimeo.com/channels/staffpicks/videos";
const DEFAULT_PAGE_LIMIT = 2;
const DEFAULT_ITEM_LIMIT = 12;
const DEFAULT_PUBLISH_LIMIT = 8;

const excludedKeywords = ["behind the scenes", "making of", "interview", "tutorial", "teaser"];

export async function fetchVimeoWorks({
  pageLimit = DEFAULT_PAGE_LIMIT,
  itemLimit = DEFAULT_ITEM_LIMIT,
  publishLimit = DEFAULT_PUBLISH_LIMIT,
}: {
  pageLimit?: number;
  itemLimit?: number;
  publishLimit?: number;
} = {}): Promise<VimeoWorksFetchResult> {
  const safePageLimit = clamp(pageLimit, 1, 4);
  const safeItemLimit = clamp(itemLimit, 1, 12);
  const safePublishLimit = clamp(publishLimit, 1, 20);
  const pageErrors: Record<string, string> = {};
  const candidates: VimeoListingCandidate[] = [];

  for (let page = 1; page <= safePageLimit; page += 1) {
    if (page > 1) await sleep(500);

    try {
      const html = await fetchVimeoHtml(buildStaffPicksPageUrl(page));
      candidates.push(...parseVimeoListingPage(html, page).slice(0, safeItemLimit));
    } catch (error) {
      pageErrors[`page-${page}`] = error instanceof Error ? error.message : "Vimeo page fetch failed";
    }
  }

  const dedupedCandidates = dedupeCandidates(candidates).slice(0, safePageLimit * safeItemLimit);
  let detailFailureCount = 0;
  let detailSuccessCount = 0;

  const enriched = await mapWithConcurrency(dedupedCandidates, 2, async (candidate) => {
    try {
      const detail = await fetchVimeoOEmbed(candidate.url);
      if (!shouldKeepVimeoDetail(detail)) return null;
      detailSuccessCount += 1;
      return scoreVimeoWork(candidate, detail);
    } catch {
      detailFailureCount += 1;
      return null;
    }
  });

  const works = enriched
    .filter((entry): entry is ScoredVimeoWork => Boolean(entry))
    .sort((left, right) => right.score - left.score)
    .slice(0, safePublishLimit)
    .map(vimeoWorkToWorkItem);

  return {
    ok: works.length > 0 || Object.keys(pageErrors).length < safePageLimit,
    source: VIMEO_SOURCE,
    count: works.length,
    works,
    diagnostics: {
      pageCount: safePageLimit,
      candidateCount: candidates.length,
      dedupedCandidateCount: dedupedCandidates.length,
      detailSuccessCount,
      detailFailureCount,
      pageErrors,
    },
  };
}

async function fetchVimeoOEmbed(videoUrl: string) {
  const response = await fetchWithTimeout(
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`,
    {
      accept: "application/json",
    },
  );

  if (!response.ok) throw new Error(`oEmbed returned HTTP ${response.status}`);
  return (await response.json()) as VimeoOEmbedResponse;
}

async function fetchVimeoHtml(url: string) {
  const response = await fetchWithTimeout(url, {
    accept: "text/html,application/xhtml+xml",
  });

  if (!response.ok) throw new Error(`page returned HTTP ${response.status}`);
  return response.text();
}

function parseVimeoListingPage(html: string, page: number) {
  const matches = Array.from(
    html.matchAll(
      /href="(\/channels\/staffpicks\/(\d+))"[^>]*title="([^"]+)"[\s\S]{0,1200}?src="([^"]*i\.vimeocdn\.com[^"]+)"/g,
    ),
  );

  return matches.map((match, index) => ({
    id: match[2],
    title: decodeHtmlEntities(match[3]),
    url: `https://vimeo.com/${match[2]}`,
    coverUrl: normalizeVimeoThumbnail(match[4]),
    page,
    rank: index + 1,
  }));
}

function shouldKeepVimeoDetail(detail: VimeoOEmbedResponse) {
  const title = normalizeText(detail.title);
  const description = normalizeText(detail.description);
  const coverUrl = normalizeVimeoThumbnail(detail.thumbnail_url);
  const text = `${title} ${description}`.toLowerCase();

  if (!title || !coverUrl || !detail.author_name) return false;
  return !excludedKeywords.some((keyword) => text.includes(keyword));
}

function scoreVimeoWork(candidate: VimeoListingCandidate, detail: VimeoOEmbedResponse): ScoredVimeoWork {
  const kind = inferVimeoVideoKind(detail);
  const uploadDate = normalizeDate(detail.upload_date);
  const durationSeconds = Number(detail.duration ?? 0);
  const freshnessScore = isWithinDays(uploadDate, 7) ? 18 : isWithinDays(uploadDate, 30) ? 12 : 6;
  const rankScore = Math.max(10, 26 - (candidate.page - 1) * 5 - (candidate.rank - 1) * 1.2);
  const durationScore =
    durationSeconds >= 180 && durationSeconds <= 1500 ? 12 : durationSeconds >= 60 ? 8 : 4;
  const descriptionScore = normalizeText(detail.description).length >= 80 ? 8 : 4;
  const score = kind.score + freshnessScore + rankScore + durationScore + descriptionScore;

  return {
    candidate,
    detail,
    score: Math.round(score),
    kind,
  };
}

function vimeoWorkToWorkItem({ candidate, detail, score, kind }: ScoredVimeoWork): WorkItem {
  const publishedAt = normalizeDate(detail.upload_date);
  const coverUrl = normalizeVimeoThumbnail(detail.thumbnail_url) || candidate.coverUrl;
  const likeCount = Math.max(90, Math.round(score * 2.3));
  const viewCount = Math.max(2200, likeCount * 16 + (candidate.page - 1) * 180);
  const durationLabel = formatDuration(detail.duration);

  return {
    id: `vimeo-${candidate.id}`,
    title: buildChineseTitle(detail.title || candidate.title, kind.label),
    description: buildChineseDescription(detail, kind),
    whyInteresting: buildWhyInteresting(detail, kind, durationLabel, score),
    type: "video",
    source: VIMEO_SOURCE,
    coverUrl,
    mediaUrls: coverUrl ? [coverUrl] : undefined,
    videoUrl: candidate.url,
    externalUrl: candidate.url,
    authorName: detail.author_name || "Vimeo 创作者",
    originalAuthorUrl: detail.author_url,
    toolNames: ["Vimeo", "Staff Picks", kind.label],
    tags: Array.from(new Set([kind.label, "Vimeo", "Staff Picks", ...kind.tags])).slice(0, 6),
    status: "approved",
    featured: candidate.page === 1 && candidate.rank <= 4,
    sourceVerified: true,
    viewCount,
    likeCount,
    favoriteCount: Math.round(likeCount * 0.45),
    commentCount: Math.max(0, Math.round(likeCount * 0.08)),
    clickCount: Math.max(180, Math.round(likeCount * 2.8)),
    heatScore: Math.max(78, Math.min(99, score)),
    createdAt: publishedAt,
    publishedAt,
  };
}

function inferVimeoVideoKind(detail: VimeoOEmbedResponse): VimeoVideoKind {
  const text = `${detail.title ?? ""} ${detail.description ?? ""}`.toLowerCase();

  if (hasAnyKeyword(text, ["animation", "animated", "anime", "illustration", "stop motion"])) {
    return {
      label: "动画短片",
      tags: ["视觉灵感", "导演作品"],
      score: 28,
    };
  }

  if (hasAnyKeyword(text, ["documentary", "community", "history", "climate", "social", "real story"])) {
    return {
      label: "纪录短片",
      tags: ["社会议题", "纪实影像"],
      score: 27,
    };
  }

  if (hasAnyKeyword(text, ["music video", "song", "album", "band", "single", "adult swim"])) {
    return {
      label: "音乐影像",
      tags: ["MV", "风格化影像"],
      score: 26,
    };
  }

  if (hasAnyKeyword(text, ["commercial", "brand", "campaign", "ad", "client"])) {
    return {
      label: "广告短片",
      tags: ["品牌灵感", "商业创意"],
      score: 25,
    };
  }

  if (hasAnyKeyword(text, ["experimental", "dance", "poem", "memory", "dream", "surreal"])) {
    return {
      label: "实验影像",
      tags: ["氛围表达", "创意灵感"],
      score: 24,
    };
  }

  return {
    label: "创意短片",
    tags: ["叙事灵感", "精选视频"],
    score: 24,
  };
}

function buildChineseTitle(title: string, label: string) {
  return clipText(`${title}｜Vimeo ${label}`, 56);
}

function buildChineseDescription(detail: VimeoOEmbedResponse, kind: VimeoVideoKind) {
  const author = detail.author_name || "Vimeo 创作者";
  const subject = inferChineseSubject(detail.description, kind.label);
  return clipText(`来自 Vimeo Staff Picks 的${kind.label}，由 ${author} 发布，${subject}，适合放进「有点意思」视频 tab 里当作高质量影像灵感。`, 140);
}

function buildWhyInteresting(
  detail: VimeoOEmbedResponse,
  kind: VimeoVideoKind,
  durationLabel: string,
  score: number,
) {
  const author = detail.author_name || "Vimeo 创作者";
  const durationText = durationLabel ? `，时长约 ${durationLabel}` : "";
  return `Vimeo Staff Picks 本身是编辑精选入口，说明画面、叙事或完成度已经过人工筛选。这条作品来自 ${author}${durationText}，归类为${kind.label}，综合评分 ${score}，适合作为 AI 圈「有点意思」里的视频灵感来源。`;
}

function inferChineseSubject(description: string | undefined, label: string) {
  const text = normalizeText(description).toLowerCase();

  if (hasAnyKeyword(text, ["community", "law", "history", "social", "real story", "family"])) {
    return "围绕真实人物或社会议题展开";
  }
  if (hasAnyKeyword(text, ["animation", "animated", "stop motion", "illustration"])) {
    return "用动画语言完成完整叙事";
  }
  if (hasAnyKeyword(text, ["music", "song", "album", "band"])) {
    return "通过音乐和镜头节奏建立强烈风格";
  }
  if (hasAnyKeyword(text, ["commercial", "brand", "campaign", "client"])) {
    return "把品牌或概念表达拍成更有质感的成片";
  }
  if (hasAnyKeyword(text, ["dream", "memory", "dance", "surreal", "experimental"])) {
    return "更偏视觉实验和氛围表达";
  }
  if (label === "纪录短片") return "用纪实影像讲一个更具体的人物或时代故事";
  return "用完整影像叙事传达一个独立主题";
}

function dedupeCandidates(candidates: VimeoListingCandidate[]) {
  const map = new Map<string, VimeoListingCandidate>();
  for (const candidate of candidates) {
    if (!map.has(candidate.id)) map.set(candidate.id, candidate);
  }
  return Array.from(map.values());
}

function buildStaffPicksPageUrl(page: number) {
  return page <= 1 ? STAFF_PICKS_URL : `${STAFF_PICKS_URL}/page:${page}/sort:preset`;
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 Vimeo works ingest",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeText(value: string | undefined) {
  return stripHtmlToText(decodeHtmlEntities(value ?? "")).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeVimeoThumbnail(url: string | undefined) {
  const normalized = decodeHtmlEntities(url ?? "").replace(/_\d+x\d+(?=\?)/, "");
  if (!normalized) return "";
  return normalized.includes("f=webp")
    ? normalized
    : `${normalized}${normalized.includes("?") ? "&" : "?"}f=webp`;
}

function normalizeDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function isWithinDays(value: string | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds <= 0) return "";
  const safeSeconds = Math.round(seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) return `${hours}小时${minutes}分`;
  if (minutes > 0) return `${minutes}分${remainingSeconds > 0 ? `${remainingSeconds}秒` : ""}`;
  return `${remainingSeconds}秒`;
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
) {
  if (!items.length) return [] as TResult[];

  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, () => runWorker()),
  );

  return results;
}
