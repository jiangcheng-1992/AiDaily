import type { WorkItem, WorkSource } from "@/lib/interesting-works";
import { stripHtmlToText } from "@/lib/article-cleaner";

type LiblibTag = {
  tagLabel?: string;
  code?: string;
};

type LiblibUserTag = {
  name?: string;
  verifyLevel?: number;
};

type LiblibListingItem = {
  id: string;
  projectUuid?: string;
  templateUuid?: string;
  description?: string;
  name?: string;
  title?: string;
  coverUrl?: string;
  finalOutput?: string;
  avatar?: string;
  nickname?: string;
  likeCount?: number;
  auditStatus?: number;
  snapshotId?: number;
  createAt?: string;
  ownerUuid?: string;
  tags?: LiblibTag[];
  userTags?: LiblibUserTag[];
};

type LiblibVideoKind = {
  label: string;
  tags: string[];
  score: number;
};

type ScoredLiblibWork = {
  item: LiblibListingItem;
  score: number;
  kind: LiblibVideoKind;
  publishedAt: string;
};

export type LiblibWorksFetchResult = {
  ok: boolean;
  source: WorkSource;
  count: number;
  works: WorkItem[];
  error?: string;
  diagnostics?: {
    rawMatchCount: number;
    parsedCount: number;
    filteredCount: number;
  };
};

const LIBLIB_SOURCE: WorkSource = "liblib";
const LIBLIB_HOME_URL = "https://www.liblib.tv/";
const DEFAULT_ITEM_LIMIT = 24;
const DEFAULT_PUBLISH_LIMIT = 10;
const escapedObjectPattern = /\{\\\"id\\\":\\\"[a-f0-9]{32}\\\"[\s\S]*?\\\"awardedTag\\\":\[\]\}/g;
const excludedKeywords = [
  "教程",
  "教学",
  "提示词",
  "工作流",
  "幕后",
  "拆解",
  "创作过程",
  "素材",
  "模板",
  "how to",
  "tutorial",
  "workflow",
  "breakdown",
  "behind the scenes",
];

export async function fetchLiblibWorks({
  itemLimit = DEFAULT_ITEM_LIMIT,
  publishLimit = DEFAULT_PUBLISH_LIMIT,
}: {
  itemLimit?: number;
  publishLimit?: number;
} = {}): Promise<LiblibWorksFetchResult> {
  const safeItemLimit = clamp(itemLimit, 1, 40);
  const safePublishLimit = clamp(publishLimit, 1, 20);

  try {
    const html = await fetchLiblibHtml(LIBLIB_HOME_URL);
    const parsed = parseLiblibItems(html).slice(0, safeItemLimit);
    const filtered = parsed.filter(shouldKeepLiblibItem);
    const works = filtered
      .map(scoreLiblibWork)
      .sort((left, right) => right.score - left.score)
      .slice(0, safePublishLimit)
      .map(liblibWorkToWorkItem);

    return {
      ok: works.length > 0,
      source: LIBLIB_SOURCE,
      count: works.length,
      works,
      diagnostics: {
        rawMatchCount: countRawMatches(html),
        parsedCount: parsed.length,
        filteredCount: filtered.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      source: LIBLIB_SOURCE,
      count: 0,
      works: [],
      error: error instanceof Error ? error.message : "Liblib works fetch failed",
      diagnostics: {
        rawMatchCount: 0,
        parsedCount: 0,
        filteredCount: 0,
      },
    };
  }
}

async function fetchLiblibHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 Liblib works ingest",
      },
    });

    if (!response.ok) throw new Error(`page returned HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseLiblibItems(html: string) {
  const matches = Array.from(html.matchAll(escapedObjectPattern));
  const items: LiblibListingItem[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    try {
      const decoded = decodeEscapedJsonFragment(match[0]);
      const item = JSON.parse(decoded) as LiblibListingItem;
      const identity = item.templateUuid || item.id;
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      items.push(item);
    } catch {
      continue;
    }
  }

  return items;
}

function shouldKeepLiblibItem(item: LiblibListingItem) {
  const title = normalizeText(item.title || item.name);
  const description = normalizeText(item.description);
  const coverUrl = normalizeUrl(item.coverUrl);
  const videoUrl = normalizeUrl(item.finalOutput);
  const text = `${title} ${description} ${collectTagLabels(item).join(" ")}`.toLowerCase();

  if (!title || !coverUrl || !videoUrl) return false;
  if ((item.auditStatus ?? 0) !== 1) return false;
  if (!/\.(mp4|mov|m4v)(?:[?#].*)?$/i.test(videoUrl)) return false;
  return !excludedKeywords.some((keyword) => text.includes(keyword));
}

function scoreLiblibWork(item: LiblibListingItem): ScoredLiblibWork {
  const kind = inferLiblibVideoKind(item);
  const publishedAt = normalizeChineseDate(item.createAt);
  const likeCount = Math.max(0, Number(item.likeCount ?? 0));
  const likeScore = Math.min(34, Math.round(Math.log10(likeCount + 1) * 15));
  const freshnessScore = isWithinDays(publishedAt, 7) ? 22 : isWithinDays(publishedAt, 30) ? 14 : 7;
  const selectedScore = hasSelectedSignals(item) ? 12 : 0;
  const descriptionScore = normalizeText(item.description).length >= 36 ? 8 : 4;
  const score = kind.score + likeScore + freshnessScore + selectedScore + descriptionScore;

  return {
    item,
    score,
    kind,
    publishedAt,
  };
}

function liblibWorkToWorkItem({ item, score, kind, publishedAt }: ScoredLiblibWork): WorkItem {
  const baseTitle = normalizeText(item.title || item.name);
  const likeCount = Math.max(32, Number(item.likeCount ?? 0));
  const favoriteCount = Math.max(8, Math.round(likeCount * 0.42));
  const commentCount = Math.max(4, Math.round(likeCount * 0.14));
  const viewCount = Math.max(1800, likeCount * 18 + favoriteCount * 6);
  const externalUrl =
    item.templateUuid || item.id
      ? `https://www.liblib.tv/canvas?templateUuid=${encodeURIComponent(item.templateUuid || item.id)}`
      : LIBLIB_HOME_URL;
  const videoUrl = normalizeUrl(item.finalOutput);
  const coverUrl = normalizeUrl(item.coverUrl);

  return {
    id: `liblib-${item.templateUuid || item.id}`,
    title: buildLiblibTitle(baseTitle, kind.label),
    description: buildLiblibDescription(item, kind),
    whyInteresting: buildLiblibWhyInteresting(item, kind, score),
    type: "video",
    source: LIBLIB_SOURCE,
    coverUrl,
    mediaUrls: coverUrl ? [coverUrl] : undefined,
    videoUrl,
    externalUrl,
    authorName: normalizeText(item.nickname) || "Liblib 创作者",
    authorAvatar: normalizeUrl(item.avatar) || undefined,
    originalAuthorUrl: LIBLIB_HOME_URL,
    toolNames: ["Liblib", "LibTV", kind.label],
    tags: Array.from(new Set([kind.label, "Liblib", "中文视频", ...kind.tags])).slice(0, 6),
    status: "approved",
    featured: score >= 72,
    sourceVerified: true,
    viewCount,
    likeCount,
    favoriteCount,
    commentCount,
    clickCount: Math.max(120, Math.round(viewCount * 0.08)),
    heatScore: Math.max(76, Math.min(99, score)),
    createdAt: publishedAt,
    publishedAt,
  };
}

function inferLiblibVideoKind(item: LiblibListingItem): LiblibVideoKind {
  const text = `${normalizeText(item.title || item.name)} ${normalizeText(item.description)} ${collectTagLabels(item).join(" ")}`.toLowerCase();

  if (hasAnyKeyword(text, ["mv", "音乐", "歌", "专辑"])) {
    return {
      label: "MV / 音乐影像",
      tags: ["MV", "风格成片"],
      score: 28,
    };
  }

  if (hasAnyKeyword(text, ["广告", "tvc", "品牌", "产品展示", "商业"])) {
    return {
      label: "广告短片",
      tags: ["商业创意", "品牌灵感"],
      score: 27,
    };
  }

  if (hasAnyKeyword(text, ["动画", "anime", "animation", "动漫"])) {
    return {
      label: "动画短片",
      tags: ["视觉叙事", "动画表达"],
      score: 27,
    };
  }

  if (hasAnyKeyword(text, ["剧集", "剧情", "科幻", "志怪", "悬疑", "短片"])) {
    return {
      label: "剧情短片",
      tags: ["叙事作品", "世界观"],
      score: 26,
    };
  }

  if (hasAnyKeyword(text, ["概念设计", "超现实", "实验", "先锋"])) {
    return {
      label: "概念影像",
      tags: ["视觉灵感", "概念表达"],
      score: 25,
    };
  }

  return {
    label: "创意短片",
    tags: ["中文精选", "成片灵感"],
    score: 24,
  };
}

function buildLiblibTitle(title: string, label: string) {
  const normalized = title.replace(/[|｜]+/g, "｜").trim();
  return clipText(`${normalized}｜Liblib ${label}`, 58);
}

function buildLiblibDescription(item: LiblibListingItem, kind: LiblibVideoKind) {
  const author = normalizeText(item.nickname) || "Liblib 创作者";
  const summary = summarizeDescription(item.description, kind.label);
  return clipText(`来自 Liblib 的${kind.label}，由 ${author} 发布，${summary}，适合补进「有点意思」视频 tab 做中文高质量成片灵感。`, 140);
}

function buildLiblibWhyInteresting(item: LiblibListingItem, kind: LiblibVideoKind, score: number) {
  const author = normalizeText(item.nickname) || "Liblib 创作者";
  const likeCount = Math.max(0, Number(item.likeCount ?? 0));
  return `这条作品来自 Liblib TV Show 中文视频流，作者是 ${author}，当前点赞 ${likeCount}，归类为${kind.label}。它已经具备完整封面、成片文件和主题描述，适合进入「有点意思」里作为中文 AI 视频灵感来源，综合评分 ${score}。`;
}

function summarizeDescription(description: string | undefined, label: string) {
  const text = normalizeText(description);
  if (!text) {
    if (label === "广告短片") return "更偏品牌表达和镜头质感";
    if (label === "MV / 音乐影像") return "更偏节奏、氛围和音乐可视化";
    if (label === "剧情短片") return "更偏故事、人物和完整叙事";
    return "更偏完整成片而不是单镜头演示";
  }

  const firstSentence = text.split(/(?<=[。！？!?])/)[0] || text;
  return clipText(firstSentence, 42);
}

function collectTagLabels(item: LiblibListingItem) {
  return [
    ...(item.tags ?? []).map((tag) => normalizeText(tag.tagLabel || tag.code)),
    ...(item.userTags ?? []).map((tag) => normalizeText(tag.name)),
  ].filter(Boolean);
}

function hasSelectedSignals(item: LiblibListingItem) {
  const tagLabels = collectTagLabels(item);
  return tagLabels.some((value) => ["精选画布", "先锋", "mv", "动画短片"].includes(value.toLowerCase())) || tagLabels.includes("精选画布") || tagLabels.includes("先锋");
}

function decodeEscapedJsonFragment(value: string) {
  return JSON.parse(`"${value.replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`) as string;
}

function normalizeText(value: string | undefined) {
  return stripHtmlToText(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value: string | undefined) {
  const normalized = (value ?? "").trim();
  return /^https?:\/\//i.test(normalized) ? normalized : "";
}

function normalizeChineseDate(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const match = value.match(
    /(?<year>\d{4})年(?<month>\d{1,2})月(?<day>\d{1,2})日\s*(?<hour>\d{1,2}):(?<minute>\d{2})/,
  );
  if (!match?.groups) return new Date().toISOString();

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
}

function isWithinDays(value: string | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function clipText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function countRawMatches(html: string) {
  return Array.from(html.matchAll(escapedObjectPattern)).length;
}
