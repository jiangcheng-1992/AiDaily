import type { WorkItem, WorkSource } from "@/lib/interesting-works";

type ItchGameCard = {
  id: string;
  title: string;
  url: string;
  authorName?: string;
  authorUrl?: string;
  description: string;
  coverUrl: string;
  genre?: string;
  sourceUrl: string;
  sourceLabel: string;
};

type ItchGameDetail = {
  title: string;
  description: string;
  coverUrl: string;
  pageText: string;
  tags: string[];
  ratingValue?: number;
  ratingCount?: number;
  commentCount?: number;
  screenshotCount: number;
  publishedAt?: string;
};

type ScoredItchGame = {
  card: ItchGameCard;
  detail: ItchGameDetail;
  score: number;
};

export type ItchioFetchResult = {
  ok: boolean;
  source: WorkSource;
  count: number;
  works: WorkItem[];
  error?: string;
};

const ITCHIO_SOURCE: WorkSource = "itchio";
const ITCHIO_BASE_URL = "https://itch.io";
const DEFAULT_SOURCE_LIMIT = 20;
const DEFAULT_REVIEW_LIMIT = 10;
const DEFAULT_PUBLISH_LIMIT = 3;
const itchioSourcePages = [
  {
    url: "https://itch.io/games/html5/tag-ai",
    label: "HTML5 + AI",
    aiTagged: true,
  },
  {
    url: "https://itch.io/games/html5/tag-artificial-intelligence",
    label: "HTML5 + artificial-intelligence",
    aiTagged: true,
  },
  {
    url: "https://itch.io/games/html5/tag-ai-generated",
    label: "HTML5 + ai-generated",
    aiTagged: true,
  },
  {
    url: "https://itch.io/games/html5/tag-play-in-browser",
    label: "HTML5 + play in browser",
    aiTagged: false,
  },
  {
    url: "https://itch.io/games/platform-mobile-web",
    label: "Mobile Web games",
    aiTagged: false,
  },
];
const aiKeywords = [
  "ai",
  "artificial intelligence",
  "ai-generated",
  "ai generated",
  "neural network",
  "machine learning",
  "chatgpt",
  "gpt",
  "llm",
  "generative",
  "agent",
  "bot",
];
const preferredKeywords = [
  "game jam",
  "jam",
  "featured",
  "experimental",
  "interactive fiction",
  "browser",
  "mobile",
  "touchscreen",
];
const rejectKeywords = [
  "adult",
  "nsfw",
  "asset pack",
  "game assets",
  "asset store",
  "tools",
  "toolkit",
  "plugin",
  "template",
  "source code only",
  "steam",
  "external download only",
  "download only",
  "windows only",
  "macos only",
  "linux only",
  "low effort",
  "prototype only",
];

export async function fetchItchioWorks({
  sourceLimit = DEFAULT_SOURCE_LIMIT,
  reviewLimit = DEFAULT_REVIEW_LIMIT,
  publishLimit = DEFAULT_PUBLISH_LIMIT,
}: {
  sourceLimit?: number;
  reviewLimit?: number;
  publishLimit?: number;
} = {}): Promise<ItchioFetchResult> {
  try {
    const sourceLimitPerPage = Math.max(1, Math.min(sourceLimit, 20));
    const reviewCount = Math.max(1, Math.min(reviewLimit, 10));
    const publishCount = Math.max(1, Math.min(publishLimit, reviewCount));
    const cards = await fetchItchioGameCards(sourceLimitPerPage);
    const uniqueCards = dedupeCards(cards).slice(0, reviewCount * 3);
    const scored = await mapWithConcurrency(uniqueCards, 3, async (card) => {
      const detail = await fetchItchioGameDetail(card.url);
      if (!passesHardFilters(card, detail)) return null;
      const score = scoreItchioGame(card, detail);
      if (score < 75) return null;
      return { card, detail, score };
    });
    const works = scored
      .filter((item): item is ScoredItchGame => Boolean(item))
      .sort((left, right) => right.score - left.score)
      .slice(0, publishCount)
      .map(itchGameToWork);

    return {
      ok: true,
      source: ITCHIO_SOURCE,
      count: works.length,
      works,
    };
  } catch (error) {
    return {
      ok: false,
      source: ITCHIO_SOURCE,
      count: 0,
      works: [],
      error: error instanceof Error ? error.message : "itch.io fetch failed",
    };
  }
}

async function fetchItchioGameCards(sourceLimit: number) {
  const cardGroups = await mapWithConcurrency(itchioSourcePages, 2, async (source) => {
    const response = await fetchWithTimeout(source.url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 itch.io ingest",
      },
    });

    if (!response.ok) {
      throw new Error(`itch.io source ${source.url} returned HTTP ${response.status}`);
    }

    const html = await response.text();
    return extractGameCards(html, source.url, source.label).slice(0, sourceLimit);
  });

  return cardGroups.flat();
}

function extractGameCards(html: string, sourceUrl: string, sourceLabel: string): ItchGameCard[] {
  return html
    .split(/<div\s+data-game_id=/i)
    .slice(1)
    .map((part) => `<div data-game_id=${part}`)
    .map((chunk) => normalizeGameCard(chunk, sourceUrl, sourceLabel))
    .filter((card): card is ItchGameCard => Boolean(card));
}

function normalizeGameCard(
  chunk: string,
  sourceUrl: string,
  sourceLabel: string,
): ItchGameCard | null {
  const id = readAttr(chunk, "data-game_id");
  const titleAnchor = matchFirst(chunk, /<div class="game_title">([\s\S]*?)<\/div>/i);
  const url = normalizeItchUrl(readAttr(titleAnchor, "href") || readAttr(chunk, "href"));
  const title = cleanText(stripHtml(titleAnchor));
  const description =
    cleanText(readAttr(matchFirst(chunk, /<div class="game_text"[\s\S]*?<\/div>/i), "title")) ||
    cleanText(stripHtml(matchFirst(chunk, /<div class="game_text"[\s\S]*?<\/div>/i)));
  const coverUrl = normalizeImageUrl(
    readAttr(chunk, "data-lazy_src") ||
      readAttr(chunk, "src") ||
      readAttr(chunk, "data-background_image"),
  );
  const authorBlock = matchFirst(chunk, /<div class="game_author">([\s\S]*?)<\/div>/i);
  const authorName = cleanText(stripHtml(authorBlock));
  const authorUrl = normalizeItchUrl(readAttr(authorBlock, "href"));
  const genre = cleanText(stripHtml(matchFirst(chunk, /<div class="game_genre">([\s\S]*?)<\/div>/i)));

  if (!id || !title || !url) return null;

  return {
    id,
    title,
    url,
    authorName,
    authorUrl,
    description,
    coverUrl,
    genre,
    sourceUrl,
    sourceLabel,
  };
}

async function fetchItchioGameDetail(url: string): Promise<ItchGameDetail> {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 itch.io ingest",
    },
  });

  if (!response.ok) {
    throw new Error(`itch.io game ${url} returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const pageText = cleanText(stripHtml(html));
  const metadata = readJsonLdMetadata(html);
  const description =
    readMeta(html, "description") ||
    readMeta(html, "og:description") ||
    metadata.description ||
    "";
  const coverUrl =
    normalizeImageUrl(readMeta(html, "og:image") || readMeta(html, "twitter:image")) ||
    "";

  return {
    title: metadata.name || readTitle(html),
    description: cleanText(description),
    coverUrl,
    pageText,
    tags: extractTags(html),
    ratingValue: metadata.ratingValue,
    ratingCount: metadata.ratingCount,
    commentCount: extractCommentCount(html),
    screenshotCount: countMatches(html, /screenshot|image_gallery|screenshot_list|class="screenshot"/gi),
    publishedAt: readPublishedAt(html),
  };
}

function passesHardFilters(card: ItchGameCard, detail: ItchGameDetail) {
  const combinedText = [
    card.title,
    card.description,
    card.genre,
    card.sourceUrl,
    detail.title,
    detail.description,
    detail.tags.join(" "),
    detail.pageText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const sourceAllowsBrowser =
    card.sourceUrl.includes("/games/html5") || card.sourceUrl.includes("/platform-mobile-web");
  const playableInBrowser =
    sourceAllowsBrowser ||
    combinedText.includes("play in browser") ||
    combinedText.includes("play in your browser") ||
    detail.tags.some((tag) => tag.toLowerCase() === "html5");
  const hasCover = Boolean(detail.coverUrl || card.coverUrl);
  const hasDescription = Boolean(detail.description || card.description);
  const hasInteraction =
    Number(detail.ratingCount ?? 0) > 0 ||
    Number(detail.commentCount ?? 0) > 0 ||
    combinedText.includes("rated") ||
    combinedText.includes("comments");
  const rejected = rejectKeywords.some((keyword) => combinedText.includes(keyword));
  const downloadOnly =
    !playableInBrowser &&
    (combinedText.includes("download now") || combinedText.includes("install instructions"));

  return (
    sourceAllowsBrowser &&
    playableInBrowser &&
    hasCover &&
    hasDescription &&
    hasInteraction &&
    !rejected &&
    !downloadOnly
  );
}

function scoreItchioGame(card: ItchGameCard, detail: ItchGameDetail) {
  const combinedText = [
    card.title,
    card.description,
    card.genre,
    card.sourceLabel,
    detail.title,
    detail.description,
    detail.tags.join(" "),
    detail.pageText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const ratingValue = Number(detail.ratingValue ?? 0);
  const ratingCount = Number(detail.ratingCount ?? 0);
  const commentCount = Number(detail.commentCount ?? 0);
  const visualScore = Math.min(25, 12 + (detail.coverUrl || card.coverUrl ? 8 : 0) + Math.min(detail.screenshotCount, 5));
  const gameplayScore = Math.min(
    25,
    14 +
      (combinedText.includes("play in browser") || combinedText.includes("play in your browser") ? 6 : 0) +
      (detail.description.length > 80 ? 3 : 0) +
      (card.genre ? 2 : 0),
  );
  const aiScore = Math.min(
    20,
    (aiKeywords.some((keyword) => combinedText.includes(keyword)) ? 12 : 0) +
      (card.sourceLabel.toLowerCase().includes("ai") ? 5 : 0) +
      (detail.tags.some((tag) => /ai|artificial|generated/i.test(tag)) ? 3 : 0),
  );
  const spreadScore = Math.min(
    15,
    (preferredKeywords.some((keyword) => combinedText.includes(keyword)) ? 5 : 0) +
      (combinedText.includes("jam") ? 4 : 0) +
      (combinedText.includes("funny") || combinedText.includes("satirical") ? 3 : 0) +
      (detail.description.length > 40 ? 3 : 0),
  );
  const interactionScore = Math.min(
    10,
    (ratingValue >= 4 ? 3 : 0) + Math.min(ratingCount, 5) + Math.min(commentCount, 2),
  );
  const mobileScore = combinedText.includes("mobile") || card.sourceUrl.includes("platform-mobile-web") ? 5 : 0;

  return visualScore + gameplayScore + aiScore + spreadScore + interactionScore + mobileScore;
}

function itchGameToWork({ card, detail, score }: ScoredItchGame): WorkItem {
  const coverUrl = detail.coverUrl || card.coverUrl;
  const description = buildChineseDescription(card, detail);
  const ratingCount = Number(detail.ratingCount ?? 0);
  const commentCount = Number(detail.commentCount ?? 0);
  const likeCount = Math.max(Math.round(score * 2 + ratingCount * 8), 1);
  const createdAt = normalizeDate(detail.publishedAt);

  return {
    id: `itchio-${slugify(card.id || card.title)}`,
    title: buildChineseTitle(card, detail),
    description,
    whyInteresting: buildWhyInteresting(card, detail, score),
    type: "app",
    source: ITCHIO_SOURCE,
    coverUrl,
    externalUrl: card.url,
    authorName: card.authorName || "itch.io creator",
    originalAuthorUrl: card.authorUrl,
    toolNames: ["itch.io", "HTML5", "Browser Game"],
    tags: buildTags(card, detail),
    status: "approved",
    featured: score >= 88,
    sourceVerified: true,
    viewCount: Math.max(likeCount * 18, 800),
    likeCount,
    favoriteCount: Math.round(likeCount * 0.42),
    commentCount,
    clickCount: Math.max(likeCount * 3, 120),
    heatScore: Math.max(75, Math.min(99, Math.round(score))),
    createdAt,
    publishedAt: createdAt,
  };
}

function buildChineseTitle(card: ItchGameCard, detail: ItchGameDetail) {
  const useCase = inferGameUseCase(card, detail);
  return clipText(`${card.title}：${useCase}`, 46);
}

function buildChineseDescription(card: ItchGameCard, detail: ItchGameDetail) {
  const original = cleanText(detail.description || card.description);
  const genre = card.genre ? `${card.genre} 类型` : "独立小游戏";
  const useCase = inferGameUseCase(card, detail);

  if (original) {
    return clipText(`一个 itch.io 上可直接试玩的 ${genre}，主打${useCase}。原始介绍：${original}`, 130);
  }

  return `一个 itch.io 上可直接试玩的 ${genre}，主打${useCase}，适合无需下载直接体验。`;
}

function buildWhyInteresting(card: ItchGameCard, detail: ItchGameDetail, score: number) {
  const ratingText = detail.ratingCount
    ? `，已有 ${detail.ratingCount} 个评分信号`
    : detail.commentCount
      ? `，已有 ${detail.commentCount} 条评论信号`
      : "";
  const jamText = `${card.sourceLabel} ${detail.tags.join(" ")}`.toLowerCase().includes("jam")
    ? "它来自 game jam 或相关标签，通常更适合观察独立开发者如何快速验证玩法。"
    : "它把 AI 相关概念做成了可以直接上手的浏览器游戏，比单纯工具列表更适合试玩和传播。";

  return `${jamText} 这条作品满足浏览器可玩、有封面和简介等硬条件${ratingText}，精品评分 ${Math.round(score)}，适合放进「有点意思」作为 AI 小游戏样本。`;
}

function buildTags(card: ItchGameCard, detail: ItchGameDetail) {
  const sourceText = `${card.sourceLabel} ${card.genre ?? ""} ${detail.tags.join(" ")}`.toLowerCase();
  const tags = ["AI小游戏", "H5游戏", "浏览器可玩", "无需下载"];

  if (sourceText.includes("jam")) tags.push("GameJam");
  if (sourceText.includes("interactive")) tags.push("互动叙事");
  if (sourceText.includes("experimental")) tags.push("实验游戏");
  if (sourceText.includes("mobile")) tags.push("手机可玩");

  return Array.from(new Set(tags)).slice(0, 6);
}

function inferGameUseCase(card: ItchGameCard, detail: ItchGameDetail) {
  const text = `${card.title} ${card.description} ${card.genre ?? ""} ${detail.description} ${detail.tags.join(" ")}`.toLowerCase();

  if (text.includes("neural") || text.includes("machine learning")) return "用神经网络或机器学习参与玩法";
  if (text.includes("chatgpt") || text.includes("llm") || text.includes("narrator")) return "用 AI 对话或叙事驱动游戏";
  if (text.includes("generated") || text.includes("generative")) return "使用 AI 生成内容做关卡或谜题";
  if (text.includes("simulation")) return "把 AI 概念做成模拟经营或策略玩法";
  if (text.includes("interactive fiction") || text.includes("visual novel")) return "把 AI 主题做成交互叙事";
  if (text.includes("puzzle")) return "把 AI 主题做成浏览器解谜体验";
  return "围绕 AI 主题做成可试玩的浏览器小游戏";
}

function dedupeCards(cards: ItchGameCard[]) {
  const map = new Map<string, ItchGameCard>();

  for (const card of cards) {
    map.set(normalizeIdentity(card.url), card);
  }

  return Array.from(map.values());
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function readJsonLdMetadata(html: string) {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(script[1])) as {
        "@type"?: string;
        name?: string;
        description?: string;
        datePublished?: string;
        aggregateRating?: {
          ratingValue?: string | number;
          ratingCount?: string | number;
        };
      };

      if (parsed["@type"] !== "Product") continue;
      return {
        name: cleanText(parsed.name ?? ""),
        description: cleanText(parsed.description ?? ""),
        ratingValue: toNumber(parsed.aggregateRating?.ratingValue),
        ratingCount: toNumber(parsed.aggregateRating?.ratingCount),
        publishedAt: parsed.datePublished,
      };
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  }

  return {};
}

function readMeta(html: string, name: string) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }

  return "";
}

function extractTags(html: string) {
  const tags = Array.from(html.matchAll(/\/games\/(?:[^"'>\s]*\/)?tag-([a-z0-9-]+)/gi), (match) =>
    match[1].replace(/-/g, " "),
  );

  return Array.from(new Set(tags)).slice(0, 12);
}

function extractCommentCount(html: string) {
  const patterns = [
    /(\d+)\s+comments?/i,
    /comments?\s*\((\d+)\)/i,
    /class=["'][^"']*post_count[^"']*["'][^>]*>\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const value = toNumber(html.match(pattern)?.[1]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function readPublishedAt(html: string) {
  return (
    readMeta(html, "article:published_time") ||
    readJsonLdMetadata(html).publishedAt ||
    new Date().toISOString()
  );
}

function readTitle(html: string) {
  return cleanText(stripHtml(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i))).replace(/\s+by\s+.+$/i, "");
}

function readAttr(html: string, attr: string) {
  const match = html.match(new RegExp(`${escapeRegExp(attr)}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1]) : "";
}

function matchFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function cleanText(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeItchUrl(value: string) {
  if (!value) return "";
  try {
    return new URL(value, ITCHIO_BASE_URL).toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function normalizeDate(value?: string) {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeIdentity(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.toLowerCase().trim();
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clipText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function countMatches(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern)).length;
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
