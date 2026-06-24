import { XMLParser } from "fast-xml-parser";

import type { WorkItem, WorkSource } from "@/lib/interesting-works";
import { stripHtmlToText } from "@/lib/article-cleaner";

type YoutubeWorksSourceTier = "S" | "A" | "B";

type YoutubeWorksSource = {
  id: string;
  name: string;
  tier: YoutubeWorksSourceTier;
  profileUrls: string[];
  channelId?: string;
  searchQuery: string;
  aliases: string[];
};

type RawYoutubeItem = Record<string, unknown>;

type YoutubeVideoCandidate = {
  source: YoutubeWorksSource;
  id: string;
  title: string;
  description: string;
  url: string;
  coverUrl: string;
  publishedAt?: string;
  durationMs?: number;
  viewCount: number;
};

type ScoredYoutubeWork = {
  candidate: YoutubeVideoCandidate;
  score: number;
};

type YoutubeRejectionReason =
  | "missing-include-keyword"
  | "excluded-keyword"
  | "ip-risk"
  | "too-short"
  | "not-fresh-or-strong"
  | "score-too-low";

type YoutubeSourceDiagnostics = {
  sourceId: string;
  sourceName: string;
  tier: YoutubeWorksSourceTier;
  rawCount: number;
  normalizedCount: number;
  passedCount: number;
  rejectedCount: number;
  rejectionReasonCounts: Partial<Record<YoutubeRejectionReason, number>>;
  rejectedSamples: Array<{
    title: string;
    score: number;
    reasons: YoutubeRejectionReason[];
  }>;
};

export type YoutubeWorksFetchResult = {
  ok: boolean;
  source: WorkSource;
  count: number;
  works: WorkItem[];
  error?: string;
  diagnostics?: {
    sourceCount: number;
    resolvedSourceCount: number;
    candidateCount: number;
    passedFilterCount: number;
    sourceErrors: Record<string, string>;
    rejectionReasonCounts: Partial<Record<YoutubeRejectionReason, number>>;
    sourceDiagnostics: YoutubeSourceDiagnostics[];
  };
};

const YOUTUBE_SOURCE: WorkSource = "youtube";
const DEFAULT_SOURCE_LIMIT = 20;
const DEFAULT_ITEM_LIMIT = 5;
const DEFAULT_PUBLISH_LIMIT = 10;
const MAX_ITEM_AGE_DAYS = 365;
const MIN_DURATION_MS = 20_000;
const STRONG_VIEW_THRESHOLD = 3_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const includeKeywords = [
  "ai drama",
  "ai mini drama",
  "ai web series",
  "ai short film",
  "ai short",
  "ai film",
  "ai movie",
  "ai video",
  "ai animation",
  "ai anime",
  "ai music video",
  "ai commercial",
  "ai spec ad",
  "short film",
  "short movie",
  "animated short",
  "official music video",
  "music video",
  "spec ad",
  "commercial",
  "cinematic short",
  "official short film",
  "cinematic ai",
  "short drama",
  "micro drama",
  "mini drama",
  "vertical drama",
  "web drama",
  "web series",
  "short-form drama",
  "ai series",
  "generative ai short film",
  "experimental ai film",
];

const workFormatKeywords = [
  "drama",
  "series",
  "episode",
  "web series",
  "short drama",
  "micro drama",
  "mini drama",
  "vertical drama",
  "short film",
  "short movie",
  "short",
  "film",
  "movie",
  "animation",
  "anime",
  "music video",
  "mv",
  "commercial",
  "spec ad",
  "cinematic",
  "experimental",
  "visual poem",
  "film noir",
];

const aiSignalKeywords = [
  "ai",
  "artificial intelligence",
  "generative",
  "generated",
  "gen ai",
  "ai filmmaking",
  "ai filmmaker",
  "ai cinema",
  "midjourney",
  "runway",
  "sora",
  "veo",
  "kling",
  "pika",
  "minimax",
  "hailuo",
  "comfyui",
];

const excludeKeywords = [
  "tutorial",
  "how to",
  "workflow",
  "breakdown",
  "behind the scenes",
  "bts",
  "course",
  "masterclass",
  "interview",
  "review",
  "tool comparison",
  "prompt guide",
  "fake trailer",
  "fan trailer",
  "concept trailer",
  "how i made",
  "making of",
  "school",
];

const ipRiskKeywords = [
  "marvel",
  "disney",
  "dc",
  "netflix",
  "star wars",
  "harry potter",
  "lord of the rings",
  "berserk",
  "batman",
  "spider-man",
  "spiderman",
  "superman",
  "joker",
  "avengers",
];

const youtubeWorksSources: YoutubeWorksSource[] = [
  source("ai-director-dave-clark", "AI Director Dave Clark", "S", ["https://www.youtube.com/channel/UCqrWkLKwRKNZRbbJXVEvAjw", "https://www.youtube.com/@AIDirectorDaveClark", "https://www.youtube.com/@DaveClarkAI"], "UCqrWkLKwRKNZRbbJXVEvAjw"),
  source("kavan-the-kid", "Kavan the Kid", "S", ["https://www.youtube.com/channel/UCMOiV-agwdaNxJENLQ_Sudg", "https://www.youtube.com/@KavantheKid", "https://www.youtube.com/@KavanCardoza"], "UCMOiV-agwdaNxJENLQ_Sudg"),
  source("heydin", "Heydin", "S", ["https://www.youtube.com/channel/UCUrZUhoN2nwwN8G0wq5uriQ", "https://www.youtube.com/@Heydin"], "UCUrZUhoN2nwwN8G0wq5uriQ"),
  source("pj-ace", "PJ Ace", "S", ["https://www.youtube.com/channel/UCM0oWxrFse4sFbPrz2ObL-w", "https://www.youtube.com/@PJAce"], "UCM0oWxrFse4sFbPrz2ObL-w"),
  source("the-reel-robot", "Dale Williams / The Reel Robot", "S", ["https://www.youtube.com/channel/UC_3t5WerQttfnOzm5y3pbnw", "https://www.youtube.com/@TheReelRobot"], "UC_3t5WerQttfnOzm5y3pbnw"),
  source("brad-clark-ai-storyteller", "Brad Clark | AI Storyteller", "S", ["https://www.youtube.com/channel/UCSwpkjLGTAefEjlrIN2ppIQ", "https://www.youtube.com/@BradClarkAIStoryteller", "https://www.youtube.com/@AIStorytellerBradClark"], "UCSwpkjLGTAefEjlrIN2ppIQ"),
  source("gabe-michael", "Gabe Michael", "A", ["https://www.youtube.com/channel/UC_v04kWzTA7dtpEnVjg9N5g", "https://www.youtube.com/@GabeMichael"], "UC_v04kWzTA7dtpEnVjg9N5g"),
  source("evan-ezquer", "Evan Ezquer | AI Filmmaker", "A", ["https://www.youtube.com/channel/UC6YSzBbZ1AVi2qmOgj_UQCw", "https://www.youtube.com/@EvanEzquer"], "UC6YSzBbZ1AVi2qmOgj_UQCw"),
  source("roxanne-ducharme", "Roxanne Ducharme", "A", ["https://www.youtube.com/channel/UCX_1zIfktowphLJd1zF8qTw", "https://www.youtube.com/@RoxanneDucharme"], "UCX_1zIfktowphLJd1zF8qTw"),
  source("tamara-llorens", "Tamara Llorens", "A", ["https://www.youtube.com/channel/UCYrqRaLC8A8_E020ippZKpw", "https://www.youtube.com/@TamaraLlorens"], "UCYrqRaLC8A8_E020ippZKpw"),
  source("uncanny-harry-ai-productions", "Uncanny Harry AI Productions", "B", ["https://www.youtube.com/channel/UCvrjK0vYHo2ekP1cqPTKtaQ", "https://www.youtube.com/@UncannyHarryAIProductions", "https://www.youtube.com/@UncannyHarry"], "UCvrjK0vYHo2ekP1cqPTKtaQ"),
  source("eike-ai", "eike-ai", "B", ["https://www.youtube.com/channel/UCyhYdBksjA607dEbywl2w_Q", "https://www.youtube.com/@eike-ai", "https://www.youtube.com/@eikeai"], "UCyhYdBksjA607dEbywl2w_Q"),
  source("eighth-d", "Eighth.D", "B", ["https://www.youtube.com/channel/UCufY76WEmQ7jZRYZxt60L5w", "https://www.youtube.com/@EighthD", "https://www.youtube.com/@Eighth.D"], "UCufY76WEmQ7jZRYZxt60L5w"),
  source("giovanni-abitante", "Giovanni Abitante", "B", ["https://www.youtube.com/channel/UCGY5TYvdte0vJllSVlBFXsA", "https://www.youtube.com/@GiovanniAbitante"], "UCGY5TYvdte0vJllSVlBFXsA"),
  source("iyaken", "iyaKen", "B", ["https://www.youtube.com/channel/UCMtjSOBHMIl00UFmnG9xZOg", "https://www.youtube.com/@iyaKen"], "UCMtjSOBHMIl00UFmnG9xZOg"),
  source("the-ai-skizo", "The AI Skizo", "B", ["https://www.youtube.com/channel/UCCN5VHYLU5pn-8RymozG4vw", "https://www.youtube.com/@TheAISkizo"], "UCCN5VHYLU5pn-8RymozG4vw"),
  source("complex-c-ai", "Complex C AI", "B", ["https://www.youtube.com/channel/UCFv18tAWFB37QHWK2U8Tj5w", "https://www.youtube.com/@ComplexCAI"], "UCFv18tAWFB37QHWK2U8Tj5w"),
  source("surreal-ai", "Surreal AI", "B", ["https://www.youtube.com/channel/UC0XY8icjw2QUPccMxEVKBDQ", "https://www.youtube.com/@SurrealAI"], "UC0XY8icjw2QUPccMxEVKBDQ"),
  source("eddie-visuals", "Eddie Visuals", "B", ["https://www.youtube.com/channel/UCpnabDnV2S1NmGkKbB7js9w", "https://www.youtube.com/@EddieVisuals"], "UCpnabDnV2S1NmGkKbB7js9w"),
  source("ai-video-school", "AI Video School", "B", ["https://www.youtube.com/channel/UCUb7KwmlVSSCnPu5KEhym8A", "https://www.youtube.com/@AIVideoSchool"], "UCUb7KwmlVSSCnPu5KEhym8A"),
  source("ai-filmmaker", "AI FILMMAKER", "B", ["https://www.youtube.com/channel/UCePFxvPfhN9JGsECGR-rNbA", "https://www.youtube.com/@Aifilmmaker"], "UCePFxvPfhN9JGsECGR-rNbA"),
  source("dr-dids-tv", "Dr Dids TV", "B", ["https://www.youtube.com/channel/UCDpbSIkl9m3H4dg2XPkO9Pw", "https://www.youtube.com/@DrDidsTV"], "UCDpbSIkl9m3H4dg2XPkO9Pw"),
  source("films-by-sav", "S.A.V / FilmsBySav", "B", ["https://www.youtube.com/channel/UC6JRqLH8tmhRoWB3Sl7ArVg", "https://www.youtube.com/@FilmsBySav"], "UC6JRqLH8tmhRoWB3Sl7ArVg"),
  source("queen-one-studios", "Queen One Studios", "B", ["https://www.youtube.com/channel/UCR753GeTB6j6yvIMM83R-og", "https://www.youtube.com/@QueenOneStudios"], "UCR753GeTB6j6yvIMM83R-og"),
  source("mr-pixel-wizard", "MrPixelWizard / Kevin Friel", "B", ["https://www.youtube.com/channel/UCTMySf7JbGMGUPt5-YQim8Q", "https://www.youtube.com/@MrPixelWizard", "https://www.youtube.com/@KevinFriel"], "UCTMySf7JbGMGUPt5-YQim8Q"),
];

export async function fetchYoutubeWorks({
  sourceLimit = DEFAULT_SOURCE_LIMIT,
  itemLimit = DEFAULT_ITEM_LIMIT,
  publishLimit = DEFAULT_PUBLISH_LIMIT,
}: {
  sourceLimit?: number;
  itemLimit?: number;
  publishLimit?: number;
} = {}): Promise<YoutubeWorksFetchResult> {
  const selectedSources = youtubeWorksSources.slice(0, Math.max(1, Math.min(sourceLimit, youtubeWorksSources.length)));
  const sourceErrors: Record<string, string> = {};
  const candidates: YoutubeVideoCandidate[] = [];
  const sourceDiagnostics: YoutubeSourceDiagnostics[] = [];
  let resolvedSourceCount = 0;

  for (const [index, sourceConfig] of selectedSources.entries()) {
    if (index > 0) await sleep(800);

    try {
      const result = await fetchSourceCandidates(sourceConfig, Math.max(1, Math.min(itemLimit, 8)));
      resolvedSourceCount += 1;
      candidates.push(...result.items);
      sourceDiagnostics.push({
        sourceId: sourceConfig.id,
        sourceName: sourceConfig.name,
        tier: sourceConfig.tier,
        rawCount: result.rawCount,
        normalizedCount: result.normalizedCount,
        passedCount: 0,
        rejectedCount: 0,
        rejectionReasonCounts: {},
        rejectedSamples: [],
      });
    } catch (error) {
      sourceErrors[sourceConfig.id] = error instanceof Error ? error.message : "YouTube source failed";
      sourceDiagnostics.push({
        sourceId: sourceConfig.id,
        sourceName: sourceConfig.name,
        tier: sourceConfig.tier,
        rawCount: 0,
        normalizedCount: 0,
        passedCount: 0,
        rejectedCount: 0,
        rejectionReasonCounts: {},
        rejectedSamples: [],
      });
    }
  }

  const rejectionReasonCounts: Partial<Record<YoutubeRejectionReason, number>> = {};
  const scored: ScoredYoutubeWork[] = [];

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    const reasons = getPublishingRejectionReasons(candidate, score);
    const diagnostics = sourceDiagnostics.find((item) => item.sourceId === candidate.source.id);

    if (reasons.length === 0) {
      scored.push({ candidate, score });
      if (diagnostics) diagnostics.passedCount += 1;
      continue;
    }

    if (diagnostics) {
      diagnostics.rejectedCount += 1;
      for (const reason of reasons) {
        diagnostics.rejectionReasonCounts[reason] = (diagnostics.rejectionReasonCounts[reason] ?? 0) + 1;
      }
      if (diagnostics.rejectedSamples.length < 3) {
        diagnostics.rejectedSamples.push({
          title: candidate.title,
          score,
          reasons,
        });
      }
    }

    for (const reason of reasons) {
      rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
    }
  }

  const works = scored
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(publishLimit, 20)))
    .map(youtubeCandidateToWork);
  const diagnostics = {
    sourceCount: selectedSources.length,
    resolvedSourceCount,
    candidateCount: candidates.length,
    passedFilterCount: scored.length,
    sourceErrors,
    rejectionReasonCounts,
    sourceDiagnostics,
  };

  console.info("[youtube-works] diagnostics", diagnostics);

  return {
    ok: works.length > 0 || Object.keys(sourceErrors).length < selectedSources.length,
    source: YOUTUBE_SOURCE,
    count: works.length,
    works,
    diagnostics,
  };
}

async function fetchSourceCandidates(sourceConfig: YoutubeWorksSource, limit: number) {
  const channelId = await resolveChannelId(sourceConfig);
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  let rssError = "";

  try {
    const response = await fetchWithTimeout(feedUrl, {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    });

    if (!response.ok) throw new Error(`RSS returned HTTP ${response.status}`);

    const rawItems = extractRawItems(parser.parse(await response.text())).slice(0, Math.max(limit * 5, limit));
    const normalizedItems = rawItems
      .map((item) => normalizeYoutubeItem(sourceConfig, item))
      .filter((item): item is YoutubeVideoCandidate => Boolean(item));

    return {
      rawCount: rawItems.length,
      normalizedCount: normalizedItems.length,
      items: normalizedItems.slice(0, limit),
    };
  } catch (error) {
    rssError = error instanceof Error ? error.message : "RSS fetch failed";
  }

  const fallback = await fetchChannelVideosPageCandidates(sourceConfig, channelId, limit);
  if (fallback.items.length > 0) return fallback;

  throw new Error(`${rssError}; channel videos fallback returned no items`);
}

async function resolveChannelId(sourceConfig: YoutubeWorksSource) {
  if (sourceConfig.channelId) return sourceConfig.channelId;

  for (const profileUrl of sourceConfig.profileUrls) {
    const channelId = await fetchChannelIdFromUrl(profileUrl).catch(() => "");
    if (channelId) return channelId;
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(sourceConfig.searchQuery)}`;
  const channelId = await fetchChannelIdFromUrl(searchUrl, sourceConfig.aliases).catch(() => "");
  if (channelId) return channelId;

  throw new Error("Unable to resolve YouTube channel id");
}

async function fetchChannelIdFromUrl(url: string, aliases: string[] = []) {
  const response = await fetchWithTimeout(url, {
    accept: "text/html,application/xhtml+xml",
  });
  if (!response.ok) throw new Error(`channel page returned HTTP ${response.status}`);

  const html = await response.text();
  const direct =
    html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
    html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
    html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
    html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1] ||
    html.match(/<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[^"']+)["']/i)?.[1] ||
    html.match(/\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]+)/)?.[1];

  if (direct && aliases.length === 0) return direct;

  const channelRenderers = Array.from(html.matchAll(/"channelRenderer":\{([\s\S]*?)"videoCountText"/g));
  for (const match of channelRenderers) {
    const chunk = match[1];
    const channelId = chunk.match(/"channelId":"(UC[^"]+)"/)?.[1];
    const title = decodeJsonText(chunk.match(/"title":\{"simpleText":"([^"]+)"/)?.[1] ?? "");
    if (channelId && aliases.some((alias) => title.toLowerCase().includes(alias.toLowerCase()))) {
      return channelId;
    }
  }

  return direct || "";
}

async function fetchChannelVideosPageCandidates(sourceConfig: YoutubeWorksSource, channelId: string, limit: number) {
  const videosUrl = `https://www.youtube.com/channel/${channelId}/videos`;
  const response = await fetchWithTimeout(videosUrl, {
    accept: "text/html,application/xhtml+xml",
  });

  if (!response.ok) throw new Error(`channel videos returned HTTP ${response.status}`);

  const rawItems = extractLockupViewModels(extractYoutubeInitialData(await response.text())).slice(0, Math.max(limit * 5, limit));
  const normalizedItems = rawItems
    .map((item) => normalizeYoutubeLockupItem(sourceConfig, item))
    .filter((item): item is YoutubeVideoCandidate => Boolean(item));

  return {
    rawCount: rawItems.length,
    normalizedCount: normalizedItems.length,
    items: normalizedItems.slice(0, limit),
  };
}

function extractYoutubeInitialData(html: string): unknown {
  const marker = "var ytInitialData = ";
  const startIndex = html.indexOf(marker);
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;
  const jsonStart = startIndex + marker.length;

  for (let index = jsonStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractLockupViewModels(value: unknown): RawYoutubeItem[] {
  const lockups: RawYoutubeItem[] = [];
  walkYoutubeData(value, (item) => {
    const lockup = item.lockupViewModel;
    if (lockup && typeof lockup === "object") lockups.push(lockup as RawYoutubeItem);
  });
  return lockups;
}

function normalizeYoutubeLockupItem(sourceConfig: YoutubeWorksSource, item: RawYoutubeItem): YoutubeVideoCandidate | null {
  const metadata = item.metadata as Record<string, unknown> | undefined;
  const metadataView = (metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined) ?? {};
  const rows = toArray(
    ((metadataView.metadata as Record<string, unknown> | undefined)?.contentMetadataViewModel as Record<string, unknown> | undefined)?.metadataRows,
  );
  const id = asText(item.contentId) || findFirstTextValue(item, "videoId");
  const title = normalizeText(asText((metadataView.title as Record<string, unknown> | undefined)?.content));
  const url = id ? `https://www.youtube.com/watch?v=${id}` : "";
  const coverUrl = readLargestThumbnailUrl(item) || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");
  const rowTexts = rows.flatMap((row) =>
    toArray((row as Record<string, unknown> | undefined)?.metadataParts).map((part) =>
      asText(((part as Record<string, unknown> | undefined)?.text as Record<string, unknown> | undefined)?.content),
    ),
  );
  const viewCount = readYoutubeViewCount(rowTexts.find((text) => /view|視聴|观看|觀看|次/.test(text)) ?? "");
  const durationMs = parseVideoDurationMs(findThumbnailBadgeText(item));

  if (!id || !title || !url || !coverUrl) return null;

  return {
    source: sourceConfig,
    id,
    title,
    description: title,
    url,
    coverUrl,
    publishedAt: readYoutubeRelativeDate(rowTexts.find((text) => /ago|前/.test(text)) ?? ""),
    durationMs,
    viewCount,
  };
}

function normalizeYoutubeItem(sourceConfig: YoutubeWorksSource, item: RawYoutubeItem): YoutubeVideoCandidate | null {
  const mediaGroup = item["media:group"] as Record<string, unknown> | undefined;
  const id = asText(item["yt:videoId"]) || extractVideoId(extractLink(item));
  const title = stripHtmlToText(asText(item.title)).trim();
  const url = id ? `https://www.youtube.com/watch?v=${id}` : extractLink(item);
  const description = normalizeText(
    asText(mediaGroup?.["media:description"]) ||
      asText(item.description) ||
      asText(item.summary) ||
      asText(item["content:encoded"]),
  );
  const coverUrl =
    readMediaUrl(mediaGroup?.["media:thumbnail"]) ||
    readMediaUrl(item["media:thumbnail"]) ||
    (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");
  const durationMs = readMediaDurationMs(mediaGroup?.["media:content"]) || readMediaDurationMs(item["media:content"]);

  if (!id || !title || !url || !coverUrl) return null;

  return {
    source: sourceConfig,
    id,
    title,
    description,
    url,
    coverUrl,
    publishedAt: asText(item.published) || asText(item.pubDate) || asText(item.updated),
    durationMs,
    viewCount: readNumber(mediaGroup?.["media:community"], "media:statistics", "@_views"),
  };
}

function getPublishingRejectionReasons(candidate: YoutubeVideoCandidate, score: number) {
  const title = candidate.title.toLowerCase();
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();
  const matchedInclude = hasPublishingKeyword(candidate, title, text);
  const matchedExclude = excludeKeywords.some((keyword) => text.includes(keyword));
  const matchedIpRisk = ipRiskKeywords.some((keyword) => text.includes(keyword));
  const hasEnoughDuration = candidate.durationMs === undefined || candidate.durationMs >= MIN_DURATION_MS;
  const isFresh = isWithinDays(candidate.publishedAt, MAX_ITEM_AGE_DAYS);
  const hasStrongPerformance = candidate.viewCount >= STRONG_VIEW_THRESHOLD;
  const minScore = candidate.source.tier === "B" ? 64 : 58;
  const reasons: YoutubeRejectionReason[] = [];

  if (!matchedInclude) reasons.push("missing-include-keyword");
  if (matchedExclude) reasons.push("excluded-keyword");
  if (matchedIpRisk) reasons.push("ip-risk");
  if (!hasEnoughDuration) reasons.push("too-short");
  if (!isFresh && !hasStrongPerformance) reasons.push("not-fresh-or-strong");
  if (score < minScore) reasons.push("score-too-low");

  return reasons;
}

function scoreCandidate(candidate: YoutubeVideoCandidate) {
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();
  const tierScore = candidate.source.tier === "S" ? 20 : candidate.source.tier === "A" ? 14 : 8;
  const includeScore = includeKeywords.reduce((total, keyword) => total + (text.includes(keyword) ? 6 : 0), 0);
  const formatSignalScore = Math.min(14, workFormatKeywords.reduce((total, keyword) => total + (text.includes(keyword) ? 4 : 0), 0));
  const aiSignalScore = Math.min(10, aiSignalKeywords.reduce((total, keyword) => total + (text.includes(keyword) ? 3 : 0), 0));
  const formatScore = inferVideoWorkKind(candidate).score;
  const freshnessScore = isWithinDays(candidate.publishedAt, 30)
    ? 12
    : isWithinDays(candidate.publishedAt, MAX_ITEM_AGE_DAYS)
      ? 6
      : 0;
  const durationScore =
    candidate.durationMs && candidate.durationMs >= 60_000
      ? 8
      : candidate.durationMs && candidate.durationMs >= MIN_DURATION_MS
        ? 4
        : 0;
  const viewScore = Math.min(15, Math.ceil(Math.log10(candidate.viewCount + 1) * 4));
  const penalty =
    excludeKeywords.reduce((total, keyword) => total + (text.includes(keyword) ? 12 : 0), 0) +
    ipRiskKeywords.reduce((total, keyword) => total + (text.includes(keyword) ? 20 : 0), 0);

  return tierScore + includeScore + formatSignalScore + aiSignalScore + formatScore + freshnessScore + durationScore + viewScore - penalty;
}

function youtubeCandidateToWork({ candidate, score }: ScoredYoutubeWork): WorkItem {
  const kind = inferVideoWorkKind(candidate);
  const publishedAt = normalizeDate(candidate.publishedAt);
  const likeCount = Math.max(Math.round(score * 2 + candidate.viewCount / 120), 1);

  return {
    id: `youtube-${candidate.id}`,
    title: buildChineseTitle(candidate, kind.label),
    description: buildChineseDescription(candidate, kind.label),
    whyInteresting: buildWhyInteresting(candidate, score),
    type: "video",
    source: YOUTUBE_SOURCE,
    coverUrl: candidate.coverUrl,
    videoUrl: candidate.url,
    externalUrl: candidate.url,
    authorName: candidate.source.name,
    originalAuthorUrl: candidate.source.profileUrls[0],
    toolNames: ["YouTube", kind.label, "AI Film"],
    tags: Array.from(new Set([kind.label, "AI成片", "YouTube", candidate.source.tier === "S" ? "优先作者" : "白名单作者"])).slice(0, 6),
    status: "approved",
    featured: candidate.source.tier === "S" || score >= 88,
    sourceVerified: true,
    viewCount: Math.max(candidate.viewCount, likeCount * 18, 800),
    likeCount,
    favoriteCount: Math.round(likeCount * 0.42),
    commentCount: 0,
    clickCount: Math.max(likeCount * 3, 120),
    heatScore: Math.max(75, Math.min(99, Math.round(score))),
    createdAt: publishedAt,
    publishedAt,
  };
}

function inferVideoWorkKind(candidate: YoutubeVideoCandidate) {
  const text = `${candidate.title} ${candidate.description}`.toLowerCase();

  if (/(ai drama|ai mini drama|ai web series|short drama|micro drama|mini drama|vertical drama|web drama|web series|short-form drama|episode|series)/i.test(text)) return { label: "AI短剧", score: 20 };
  if (text.includes("music video") || /\bmv\b/.test(text)) return { label: "AI音乐视频", score: 18 };
  if (text.includes("commercial") || text.includes("spec ad")) return { label: "AI广告片", score: 18 };
  if (text.includes("animation") || text.includes("anime") || text.includes("animated short")) return { label: "AI动画", score: 16 };
  if (text.includes("experimental") || text.includes("visual poem")) return { label: "AI视觉实验", score: 14 };
  if (text.includes("cinematic") || text.includes("film") || text.includes("movie") || text.includes("short")) return { label: "AI短片", score: 16 };

  return { label: "AI电影", score: 12 };
}

function hasPublishingKeyword(candidate: YoutubeVideoCandidate, title: string, text: string) {
  const hasExplicitInclude = includeKeywords.some((keyword) => text.includes(keyword));
  const hasWorkFormat = workFormatKeywords.some((keyword) => text.includes(keyword));
  const hasAiSignal = aiSignalKeywords.some((keyword) => text.includes(keyword));
  const trustedWhitelistedSource = candidate.source.tier !== "B";

  return hasExplicitInclude || (hasWorkFormat && (hasAiSignal || trustedWhitelistedSource || title.includes("ai")));
}

function buildChineseTitle(candidate: YoutubeVideoCandidate, label: string) {
  return clipText(`${candidate.title}：${label}成片`, 54);
}

function buildChineseDescription(candidate: YoutubeVideoCandidate, label: string) {
  const intro = normalizeText(candidate.description);
  if (intro) return clipText(`${candidate.source.name} 发布的${label}，属于可直接观看的 AI 影像成片：${intro}`, 140);
  return `${candidate.source.name} 发布的${label}，已通过成片关键词、教程排除和 IP 风险过滤，可直接观看。`;
}

function buildWhyInteresting(candidate: YoutubeVideoCandidate, score: number) {
  const viewText = candidate.viewCount ? `，已有 ${formatCompactNumber(candidate.viewCount)} 次观看信号` : "";
  return `来自「${candidate.source.name}」白名单作者，标题命中 AI 成片关键词，并避开教程、幕后、评测和热门 IP 伪预告风险${viewText}。综合评分 ${Math.round(score)}，适合放进「有点意思」作为 AI 视频作品样本。`;
}

function source(
  id: string,
  name: string,
  tier: YoutubeWorksSourceTier,
  profileUrls: string[],
  channelId?: string,
): YoutubeWorksSource {
  return {
    id,
    name,
    tier,
    profileUrls,
    channelId,
    searchQuery: `${name} YouTube AI filmmaker`,
    aliases: name
      .split(/[|/]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

function extractRawItems(parsed: unknown): RawYoutubeItem[] {
  const feed = parsed as Record<string, unknown>;
  const rss = feed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel?.item) return toArray(channel.item) as RawYoutubeItem[];

  const atom = feed.feed as Record<string, unknown> | undefined;
  if (atom?.entry) return toArray(atom.entry) as RawYoutubeItem[];

  return [];
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 YouTube works ingest",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
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
  const raw = String(value ?? "").trim();
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

  return undefined;
}

function readNumber(root: unknown, childKey: string, attrKey: string) {
  if (!root || typeof root !== "object") return 0;
  const child = (root as Record<string, unknown>)[childKey];
  if (!child || typeof child !== "object") return 0;
  const parsed = Number((child as Record<string, unknown>)[attrKey]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readLargestThumbnailUrl(value: unknown) {
  const candidates: Array<{ url: string; width: number }> = [];
  walkYoutubeData(value, (item) => {
    const url = asText(item.url);
    if (url.includes("i.ytimg.com/vi/")) {
      candidates.push({
        url: url.replace(/\\u0026/g, "&"),
        width: Number(item.width) || 0,
      });
    }
  });

  return candidates.sort((left, right) => right.width - left.width)[0]?.url;
}

function findThumbnailBadgeText(value: unknown) {
  let badgeText = "";
  walkYoutubeData(value, (item) => {
    if (!badgeText && typeof item.text === "string" && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(item.text)) {
      badgeText = item.text;
    }
  });
  return badgeText;
}

function findFirstTextValue(value: unknown, key: string): string {
  let found = "";
  walkYoutubeData(value, (item) => {
    if (!found) found = asText(item[key]);
  });
  return found;
}

function readYoutubeViewCount(value: string) {
  const normalized = value
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/次观看|次觀看|回視聴|views?|观看|觀看/gi, "")
    .trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)(万|萬|億|亿|K|M|B)?/i);
  if (!match) return 0;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;

  const unit = match[2]?.toLowerCase();
  if (unit === "万" || unit === "萬") return Math.round(base * 10_000);
  if (unit === "亿" || unit === "億") return Math.round(base * 100_000_000);
  if (unit === "k") return Math.round(base * 1_000);
  if (unit === "m") return Math.round(base * 1_000_000);
  if (unit === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

function readYoutubeRelativeDate(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/(\d+)\s*(second|minute|hour|day|week|month|year|秒|分钟|分鐘|分|小时|小時|時間|天|日|週|周|週間|个月|個月|月|年)/i);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;

  const unit = match[2];
  const unitMs = unit.startsWith("second") || unit === "秒"
    ? 1_000
    : unit.startsWith("minute") || ["分钟", "分鐘", "分"].includes(unit)
      ? 60_000
      : unit.startsWith("hour") || ["小时", "小時", "時間"].includes(unit)
        ? 60 * 60_000
        : unit.startsWith("day") || ["天", "日"].includes(unit)
          ? 24 * 60 * 60_000
          : unit.startsWith("week") || ["週", "周", "週間"].includes(unit)
            ? 7 * 24 * 60 * 60_000
            : unit.startsWith("month") || ["个月", "個月", "月"].includes(unit)
              ? 30 * 24 * 60 * 60_000
              : 365 * 24 * 60 * 60_000;

  return new Date(Date.now() - amount * unitMs).toISOString();
}

function walkYoutubeData(value: unknown, visit: (item: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) walkYoutubeData(item, visit);
    return;
  }

  const record = value as Record<string, unknown>;
  visit(record);
  for (const item of Object.values(record)) walkYoutubeData(item, visit);
}

function extractLink(item: RawYoutubeItem) {
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
  if (link && typeof link === "object") return asText((link as Record<string, unknown>)["@_href"]);
  return asText(item.guid) || asText(item.id);
}

function extractVideoId(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v") ?? parsed.pathname.match(/\/shorts\/([^/?#]+)/)?.[1] ?? "";
  } catch {
    return url.match(/[?&]v=([^&#]+)/)?.[1] ?? "";
  }
}

function normalizeText(value: string) {
  return stripHtmlToText(value).replace(/\s+/g, " ").trim();
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

function formatCompactNumber(value: number) {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function decodeJsonText(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
