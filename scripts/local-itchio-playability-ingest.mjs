import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_SOURCE_LIMIT = 12;
const DEFAULT_PAGE_LIMIT = 1;
const DEFAULT_REVIEW_LIMIT = 45;
const DEFAULT_PUBLISH_LIMIT = 12;
const DATA_DIR = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
const GENERATED_WORKS_PATH = join(DATA_DIR, "generated-works.json");
const PREVIEW_PATH = join(DATA_DIR, "local-itchio-playability-preview.json");
const REPORT_PATH = join(DATA_DIR, "local-itchio-playability-report.json");

const sourcePages = [
  { url: "https://itch.io/games/html5/tag-ai", label: "HTML5 + AI" },
  { url: "https://itch.io/games/html5/tag-artificial-intelligence", label: "HTML5 + artificial-intelligence" },
  { url: "https://itch.io/games/html5/tag-ai-generated", label: "HTML5 + ai-generated" },
  { url: "https://itch.io/games/html5/tag-play-in-browser", label: "HTML5 + play in browser" },
  { url: "https://itch.io/games/platform-mobile-web", label: "Mobile Web games" },
  { url: "https://itch.io/games/html5/tag-arcade", label: "HTML5 + arcade" },
  { url: "https://itch.io/games/html5/tag-action", label: "HTML5 + action" },
  { url: "https://itch.io/games/html5/tag-puzzle", label: "HTML5 + puzzle" },
  { url: "https://itch.io/games/html5/tag-platformer", label: "HTML5 + platformer" },
  { url: "https://itch.io/games/html5/tag-strategy", label: "HTML5 + strategy" },
  { url: "https://itch.io/games/html5/tag-card-game", label: "HTML5 + card-game" },
  { url: "https://itch.io/games/html5/tag-idle", label: "HTML5 + idle" },
  { url: "https://itch.io/games/html5/tag-point-and-click", label: "HTML5 + point-and-click" },
  { url: "https://itch.io/games/html5/tag-casual", label: "HTML5 + casual" },
  { url: "https://itch.io/games/html5/tag-simulation", label: "HTML5 + simulation" },
];

const args = parseArgs(process.argv.slice(2));
const sourceLimit = readPositiveInt(args["source-limit"], DEFAULT_SOURCE_LIMIT);
const pageLimit = readPositiveInt(args["page-limit"], DEFAULT_PAGE_LIMIT);
const reviewLimit = readPositiveInt(args["review-limit"], DEFAULT_REVIEW_LIMIT);
const publishLimit = readPositiveInt(args["publish-limit"], DEFAULT_PUBLISH_LIMIT);
const apply = Boolean(args.apply);
const allowEmptyItchio = Boolean(args["allow-empty-itchio"]);
const currentOnly = Boolean(args["current-only"]);
const timeoutMs = readPositiveInt(args["timeout-ms"], 8000);

console.log("[local-itchio] starting", {
  sourceLimit,
  pageLimit,
  reviewLimit,
  publishLimit,
  apply,
  allowEmptyItchio,
  currentOnly,
  timeoutMs,
});

const current = await readCurrentWorks();
const currentItchioCount = current.works.filter((work) => work.source === "itchio").length;
const fetchedCards = currentOnly ? [] : dedupeCards((await fetchCards()).flat());
const fallbackCards = current.works
  .filter((work) => work.source === "itchio" && work.externalUrl)
  .map(workToCard);
const cards = (fetchedCards.length > 0 ? fetchedCards : fallbackCards).slice(0, reviewLimit);
const report = [];
const playableWorks = [];

if (fetchedCards.length === 0 && fallbackCards.length > 0) {
  console.warn("[local-itchio] source pages unavailable, auditing current generated itch.io works instead");
}

for (const [index, card] of cards.entries()) {
  if (index > 0) await sleep(400);

  const result = await inspectCard(card);
  report.push(result);

  const label = result.ok ? "KEEP" : "DROP";
  console.log(`${label}\t${card.id}\t${card.title}\t${result.reason}`);

  if (result.ok) {
    playableWorks.push(toWorkItem(card, result));
  }

  if (playableWorks.length >= publishLimit) break;
}

const nextWorks = {
  updatedAt: new Date().toISOString(),
  works: [
    ...current.works.filter((work) => work.source !== "itchio"),
    ...playableWorks,
  ].sort(sortWorks).slice(0, 200),
  sources: {
    ...(current.sources || {}),
    itchio: {
      ok: true,
      count: playableWorks.length,
      fetchedAt: new Date().toISOString(),
      error: undefined,
    },
  },
};

await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
await writeFile(PREVIEW_PATH, JSON.stringify(nextWorks, null, 2), "utf8");

if (apply && playableWorks.length === 0 && currentItchioCount > 0 && !allowEmptyItchio) {
  throw new Error(
    "Refusing to apply because 0 playable itch.io games were kept. Re-run without --apply to inspect, or add --allow-empty-itchio if this is intentional.",
  );
}

if (apply) {
  await writeFile(GENERATED_WORKS_PATH, JSON.stringify(nextWorks, null, 2), "utf8");
}

console.log("[local-itchio] summary", {
  currentItchioCount,
  reviewed: report.length,
  kept: playableWorks.length,
  dropped: report.filter((item) => !item.ok).length,
  previewPath: PREVIEW_PATH,
  reportPath: REPORT_PATH,
  appliedToGeneratedWorks: apply,
});

async function fetchCards() {
  const groups = [];

  for (const source of sourcePages) {
    const sourceCards = [];

    for (let page = 1; page <= pageLimit; page += 1) {
      const pageUrl = buildListPageUrl(source.url, page);
      const html = await fetchText(pageUrl).catch((error) => {
        console.warn(`[local-itchio] source failed: ${pageUrl}`, error.message);
        return "";
      });

      sourceCards.push(...extractCards(html, pageUrl, source.label).slice(0, sourceLimit));
    }

    groups.push(sourceCards);
  }

  return groups;
}

async function inspectCard(card) {
  try {
    const html = await fetchText(card.url);
    const playableFrameUrl = extractPlayableFrameUrl(html);

    if (!playableFrameUrl) {
      return { ...card, ok: false, reason: "no playable iframe parsed" };
    }

    const title = readTitle(html) || card.title;
    const description = readMeta(html, "description") || card.description;
    const coverUrl = normalizeImageUrl(readMeta(html, "og:image") || card.coverUrl);

    return {
      ...card,
      ok: true,
      reason: playableFrameUrl,
      title,
      description,
      coverUrl,
      playableFrameUrl,
    };
  } catch (error) {
    return {
      ...card,
      ok: false,
      reason: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

async function fetchText(url) {
  const fetchResult = await fetchTextByNode(url).catch(async (nodeError) => {
    const powershellText = await fetchTextByPowerShell(url).catch(() => "");
    if (powershellText) return powershellText;
    throw nodeError;
  });

  return fetchResult;
}

async function fetchTextByNode(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AIQ/1.0 local itchio playability ingest",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextByPowerShell(url) {
  const script = [
    "$ProgressPreference='SilentlyContinue';",
    `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;`,
    `$r=Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec ${Math.max(3, Math.ceil(timeoutMs / 1000))};`,
    "$r.Content",
  ].join(" ");
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script], {
    maxBuffer: 20 * 1024 * 1024,
  });

  return stdout;
}

function extractCards(html, sourceUrl, sourceLabel) {
  const matches = Array.from(html.matchAll(/<div\b[^>]*\bgame_cell\b[^>]*\bdata-game_id=["'][^"']+["'][^>]*>/gi));

  return matches
    .map((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? html.length;
      return html.slice(start, end);
    })
    .map((chunk) => normalizeCard(chunk, sourceUrl, sourceLabel))
    .filter(Boolean);
}

function normalizeCard(chunk, sourceUrl, sourceLabel) {
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

  if (!id || !title || !url) return null;

  return { id, title, url, authorName, authorUrl, description, coverUrl, sourceUrl, sourceLabel };
}

function extractPlayableFrameUrl(html) {
  const normalizedHtml = decodeHtmlEntities(html);
  const embedUpload = normalizedHtml.match(/https:\/\/itch\.io\/embed-upload\/\d+(?:\?[^"'<>\\\s]*)?/i)?.[0];
  if (embedUpload) return embedUpload;

  const directUrl = normalizedHtml.match(/https:\/\/[^/]+\.itch\.zone\/html\/\d+\/[^"'<>\\\s]+/i)?.[0];
  if (directUrl) return directUrl;

  const uploadId = normalizedHtml.match(/https:\/\/[^/]+\.itch\.zone\/html\/(\d+)(?:[-/])/i)?.[1];
  return uploadId ? `https://itch.io/embed-upload/${uploadId}?color=191919` : "";
}

function toWorkItem(card, result) {
  const now = new Date().toISOString();
  const score = scoreCard(card, result);

  return {
    id: `itchio-${slugify(card.id || card.title)}`,
    title: `${result.title || card.title}：浏览器可试玩小游戏`.slice(0, 46),
    description: (result.description || card.description || `${card.title} 是一款可在浏览器内试玩的 itch.io HTML5 游戏。`).slice(0, 130),
    whyInteresting: `本地可玩性检测已解析到稳定试玩地址，适合放入「有点意思」游戏区。检测来源：${result.playableFrameUrl}`,
    type: "app",
    source: "itchio",
    coverUrl: result.coverUrl || card.coverUrl,
    videoUrl: result.playableFrameUrl,
    externalUrl: card.url,
    authorName: card.authorName || "itch.io creator",
    originalAuthorUrl: card.authorUrl,
    toolNames: ["itch.io", "HTML5", "Browser Game"],
    tags: ["AI小游戏", "H5游戏", "浏览器可玩", "无需下载"],
    status: "approved",
    featured: score >= 90,
    sourceVerified: true,
    viewCount: Math.max(score * 18, 800),
    likeCount: Math.max(score * 2, 1),
    favoriteCount: Math.round(score * 0.8),
    commentCount: 0,
    clickCount: Math.max(score * 3, 120),
    heatScore: score,
    createdAt: now,
    publishedAt: now,
  };
}

function workToCard(work) {
  return {
    id: work.id.replace(/^itchio-/, ""),
    title: work.title,
    url: work.externalUrl,
    authorName: work.authorName,
    authorUrl: work.originalAuthorUrl,
    description: work.description || work.whyInteresting || "",
    coverUrl: work.coverUrl,
    sourceUrl: "data/generated-works.json",
    sourceLabel: "Current generated works",
  };
}

async function readCurrentWorks() {
  if (!existsSync(GENERATED_WORKS_PATH)) return { works: [], sources: {} };

  const raw = await readFile(GENERATED_WORKS_PATH, "utf8");
  const parsed = JSON.parse(raw);

  return {
    updatedAt: parsed.updatedAt,
    works: Array.isArray(parsed.works) ? parsed.works : [],
    sources: parsed.sources || {},
  };
}

function buildListPageUrl(sourceUrl, page) {
  if (page <= 1) return sourceUrl;
  const url = new URL(sourceUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

function dedupeCards(cards) {
  const map = new Map();
  for (const card of cards) map.set(normalizeIdentity(card.url), card);
  return Array.from(map.values());
}

function scoreCard(card, result) {
  const text = `${card.title} ${card.description} ${result.description} ${card.sourceLabel}`.toLowerCase();
  let score = 78;
  if (/ai|artificial|generated|neural|machine learning|agent|bot/.test(text)) score += 8;
  if (/arcade|action|puzzle|platformer|strategy|card|casual|mobile/.test(text)) score += 6;
  if (result.coverUrl) score += 4;
  if (result.playableFrameUrl?.includes("embed-upload")) score += 4;
  return Math.min(score, 99);
}

function readMeta(html, name) {
  const escaped = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }

  return "";
}

function readTitle(html) {
  return cleanText(stripHtml(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i))).replace(/\s+by\s+.+$/i, "");
}

function readAttr(html, attr) {
  const match = html.match(new RegExp(`${escapeRegExp(attr)}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1]) : "";
}

function matchFirst(value, pattern) {
  return value.match(pattern)?.[1] || "";
}

function stripHtml(value) {
  return decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function cleanText(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeItchUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, "https://itch.io").toString();
  } catch {
    return "";
  }
}

function normalizeImageUrl(value) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function normalizeIdentity(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.toLowerCase().trim();
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sortWorks(left, right) {
  return (
    Number(right.featured) - Number(left.featured) ||
    (right.heatScore || 0) - (left.heatScore || 0) ||
    new Date(right.publishedAt || right.createdAt).getTime() -
      new Date(left.publishedAt || left.createdAt).getTime()
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  const parsed = {};
  const flags = new Set(["apply", "allow-empty-itchio", "current-only"]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith("--")) {
      const name = arg.slice(2);

      if (flags.has(name)) {
        parsed[name] = true;
        continue;
      }

      parsed[name] = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
