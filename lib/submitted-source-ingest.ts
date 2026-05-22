import type { AiSource } from "@/lib/ai-sources";
import { generateProductionAiComments } from "@/lib/ai-comment-service";
import { fetchSingleBackupVideoSource } from "@/lib/backup-video-fetcher";
import type { BackupVideoSource } from "@/lib/backup-video-sources";
import {
  type DouyinVideoItem,
  fetchDouyinVideoSourceItems,
} from "@/lib/douyin-video-fetcher";
import type { DouyinVideoSource } from "@/lib/douyin-video-sources";
import type { Comment, Post } from "@/lib/mock-data";
import { buildGeneratedPostId } from "@/lib/post-identity";
import { buildProductionPostCopy } from "@/lib/post-insights";
import { fetchSourceItems, type SourceItem } from "@/lib/source-fetcher";
import type { SubmittedSource } from "@/lib/submitted-sources-store";

export type SubmittedSourceIngestResult = {
  posts: Post[];
  comments: Record<string, Comment[]>;
};

export async function ingestSubmittedSource(
  source: SubmittedSource,
  itemLimit = 3,
): Promise<SubmittedSourceIngestResult> {
  if (source.kind === "douyin") {
    return ingestDouyinSubmittedSource(source, itemLimit);
  }

  if (source.kind === "bilibili" || source.kind === "youtube") {
    return ingestBackupVideoSubmittedSource(source, itemLimit);
  }

  return ingestRssSubmittedSource(source, itemLimit);
}

async function ingestRssSubmittedSource(
  source: SubmittedSource,
  itemLimit: number,
): Promise<SubmittedSourceIngestResult> {
  const feedUrl = source.kind === "website" ? await discoverWebsiteFeedUrl(source.url) : source.url;
  const dynamicSource: AiSource = {
    id: source.id,
    name: source.name,
    authority: "community",
    status: "ready",
    homeUrl: source.url,
    feedUrl,
    fetchType: "rss",
    language: "multi",
    cadence: "daily",
    recommendedType: "news",
    tags: ["管理员提交", "AI信息源"],
    reliabilityScore: 70,
    autoIngest: true,
    maxItemAgeDays: 14,
    includeKeywords: [
      "ai",
      "人工智能",
      "大模型",
      "agent",
      "智能体",
      "机器人",
      "openai",
      "deepseek",
      "模型",
    ],
    notes: "管理员在我的页面提交的信息源。",
  };
  const items = await fetchSourceItems(dynamicSource, itemLimit);
  const posts = await Promise.all(items.map((item) => sourceItemToPost(item, dynamicSource)));
  const comments = await buildComments(posts);

  return { posts, comments };
}

async function discoverWebsiteFeedUrl(rawUrl: string) {
  const candidates = buildFeedCandidates(rawUrl);

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "user-agent":
            process.env.AIQ_USER_AGENT ??
            "AIQ/1.0 (+https://github.com/jiangcheng-1992/AiDaily)",
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });
      if (!response.ok) continue;

      const text = await response.text();
      if (/<(rss|feed|channel|entry|item)[\s>]/i.test(text)) return url;
    } catch {
      // Try the next common feed endpoint.
    }
  }

  throw new Error("没有在这个网站发现可抓取的 RSS/Atom，请提交明确的 RSS 地址");
}

function buildFeedCandidates(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const origin = url.origin;
    const pathname = url.pathname.replace(/\/+$/, "");
    return Array.from(
      new Set([
        rawUrl,
        `${origin}${pathname}/feed`,
        `${origin}${pathname}/rss`,
        `${origin}/feed`,
        `${origin}/rss.xml`,
        `${origin}/atom.xml`,
      ]),
    );
  } catch {
    return [rawUrl];
  }
}

async function ingestDouyinSubmittedSource(
  source: SubmittedSource,
  itemLimit: number,
): Promise<SubmittedSourceIngestResult> {
  const secUserId = extractDouyinSecUserId(source.url);
  if (!secUserId) {
    throw new Error("抖音作者链接里没有识别到 secUserId，请提交 https://www.douyin.com/user/... 作者主页");
  }

  const dynamicSource: DouyinVideoSource = {
    id: source.id,
    name: source.name,
    secUserId,
    profileUrl: source.url,
    tags: ["抖音", "管理员提交", "AI视频"],
    includeKeywords: ["ai", "人工智能", "大模型", "agent", "智能体", "机器人", "deepseek"],
    autoIngest: true,
  };
  const items = await fetchDouyinVideoSourceItems(dynamicSource, itemLimit);
  const posts = await Promise.all(items.map(videoItemToPost));
  const comments = await buildComments(posts);

  return { posts, comments };
}

async function ingestBackupVideoSubmittedSource(
  source: SubmittedSource,
  itemLimit: number,
): Promise<SubmittedSourceIngestResult> {
  const platform = source.kind === "bilibili" ? "bilibili" : "youtube";
  const dynamicSource: BackupVideoSource = {
    id: source.id,
    name: source.name,
    platform,
    feedUrl: buildBackupVideoFeedUrl(source),
    profileUrl: source.url,
    bilibiliMid: source.kind === "bilibili" ? extractBilibiliMid(source.url) : undefined,
    tags: [source.kind === "bilibili" ? "B站" : "YouTube", "管理员提交", "AI视频"],
    includeKeywords: ["ai", "人工智能", "大模型", "agent", "llm", "openai", "deepseek", "模型"],
    maxItemAgeDays: 60,
    autoIngest: true,
  };
  const results = await fetchBackupVideoItemsFromSource(dynamicSource, itemLimit);
  const posts = await Promise.all(results.map(videoItemToPost));
  const comments = await buildComments(posts);

  return { posts, comments };
}

async function fetchBackupVideoItemsFromSource(
  source: BackupVideoSource,
  itemLimit: number,
): Promise<DouyinVideoItem[]> {
  return fetchSingleBackupVideoSource(source, itemLimit);
}

async function sourceItemToPost(item: SourceItem, source: AiSource): Promise<Post> {
  const collectedAt = new Date().toISOString();
  const createdAt = toIsoDate(item.publishedAt) || collectedAt;
  const tags = uniqueTags([...item.tags, "管理员提交"]).slice(0, 8);
  const copy = await buildProductionPostCopy({
    title: item.title,
    rawContent: item.content || item.summary,
    fallbackSummary: item.summary,
    sourceName: item.sourceName,
    tags,
  });

  return {
    id: buildGeneratedPostId({
      sourceId: source.id,
      sourceUrl: item.url,
      title: item.title,
      type: source.recommendedType,
    }),
    sourceId: source.id,
    type: source.recommendedType,
    title: item.title,
    summary: copy.summary,
    content: copy.content,
    whyItMatters: copy.whyItMatters,
    editorComment: copy.editorComment,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    coverImageUrl: item.coverImageUrl,
    imageUrls: item.imageUrls,
    contentBlocks: item.contentBlocks,
    tags,
    createdAt,
    collectedAt,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
  };
}

async function videoItemToPost(item: DouyinVideoItem): Promise<Post> {
  const collectedAt = new Date().toISOString();
  const createdAt = item.publishedAt || collectedAt;
  const tags = uniqueTags([...item.tags, "管理员提交"]).slice(0, 8);
  const copy = await buildProductionPostCopy({
    title: item.title,
    rawContent: item.content,
    fallbackSummary: item.summary,
    sourceName: item.sourceName,
    tags,
  });

  return {
    id: buildGeneratedPostId({
      sourceId: item.sourceId,
      sourceUrl: item.url,
      title: item.title,
      type: "video",
    }),
    sourceId: item.sourceId,
    type: "video",
    title: item.title,
    summary: copy.summary,
    content: copy.content,
    whyItMatters: copy.whyItMatters,
    editorComment: copy.editorComment,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    videoUrl: item.videoUrl,
    videoEmbedUrl: item.videoEmbedUrl,
    coverImageUrl: item.coverImageUrl,
    durationMs: item.durationMs,
    profileUrl: item.profileUrl,
    author: item.author,
    tags,
    createdAt,
    collectedAt,
    likesCount: item.likesCount,
    commentsCount: item.commentsCount,
    savesCount: item.savesCount,
    featured: item.likesCount >= 1000,
  };
}

async function buildComments(posts: Post[]) {
  const entries = await Promise.all(
    posts.map(async (post) => {
      const result = await generateProductionAiComments({ post });
      return [post.id, result.comments] as const;
    }),
  );

  return Object.fromEntries(entries);
}

function buildBackupVideoFeedUrl(source: SubmittedSource) {
  if (source.kind === "youtube") {
    const channelId = extractYouTubeChannelId(source.url);
    if (!channelId) {
      throw new Error("YouTube 作者链接暂时需要包含 channel_id 或 /channel/UC... 地址");
    }
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }

  const mid = extractBilibiliMid(source.url);
  if (!mid) {
    throw new Error("B站作者链接需要是 https://space.bilibili.com/数字 形式");
  }
  return process.env.RSSHUB_BASE_URL
    ? `${process.env.RSSHUB_BASE_URL.replace(/\/+$/, "")}/bilibili/user/video/${mid}`
    : `rsshub://bilibili/user/video/${mid}`;
}

function extractDouyinSecUserId(url: string) {
  return url.match(/\/user\/([^/?#]+)/)?.[1] ?? "";
}

function extractBilibiliMid(url: string) {
  return url.match(/space\.bilibili\.com\/(\d+)/)?.[1] ?? "";
}

function extractYouTubeChannelId(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("channel_id") ?? parsed.pathname.match(/\/channel\/(UC[^/?#]+)/)?.[1] ?? "";
  } catch {
    return url.match(/channel_id=(UC[^&#]+)/)?.[1] ?? url.match(/\/channel\/(UC[^/?#]+)/)?.[1] ?? "";
  }
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function toIsoDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
