import type { Post } from "@/lib/mock-data";
import { calculatePostScore } from "@/lib/post-score";

export type HomeChannelId =
  | "all"
  | "hot"
  | "product"
  | "agent"
  | "video"
  | "research";

export const homeChannels: Array<{
  id: HomeChannelId;
  label: string;
  description: string;
}> = [
  { id: "all", label: "全部", description: "按发布时间展示全部动态" },
  { id: "hot", label: "今日热点", description: "高评分、高互动、近 24 小时内容" },
  { id: "product", label: "产品发布", description: "模型、应用、平台和商业化动态" },
  { id: "agent", label: "Agent/工具", description: "智能体、开发工具和工作流" },
  { id: "video", label: "视频", description: "B站、YouTube、抖音视频动态" },
  { id: "research", label: "研究/论文", description: "论文、评测、基准和技术研究" },
];

export function buildHomeFeedPosts(posts: Post[]) {
  return posts.filter((post) => post.type !== "skill").sort(sortHomePosts);
}

export function filterPostsByHomeChannel(posts: Post[], channelId: HomeChannelId) {
  if (channelId === "all") return posts;
  return posts.filter((post) => postMatchesHomeChannel(post, channelId));
}

export function getDailyBriefPosts(posts: Post[], limit = 3) {
  const today = Date.now();

  return buildHomeFeedPosts(posts)
    .map((post) => ({
      post,
      score:
        calculatePostScore(post) +
        scoreFreshness(post, today) +
        scoreSourceAuthority(post) +
        (post.type === "video" ? -0.35 : 0),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        getPostPublishedSortTime(right.post) - getPostPublishedSortTime(left.post),
    )
    .slice(0, limit)
    .map((entry) => entry.post);
}

export function sortHomePosts(left: Post, right: Post) {
  return (
    getPostPublishedSortTime(right) - getPostPublishedSortTime(left) ||
    calculatePostScore(right) - calculatePostScore(left) ||
    Number(right.featured) - Number(left.featured)
  );
}

export function postMatchesHomeChannel(post: Post, channelId: HomeChannelId) {
  const text = `${post.title} ${post.summary} ${post.whyItMatters} ${post.tags.join(" ")} ${
    post.sourceName
  }`.toLowerCase();

  switch (channelId) {
    case "hot":
      return isRecentPost(post, 24) && (calculatePostScore(post) >= 8.2 || getPostHeat(post) >= 20);
    case "product":
      return /(发布|上线|开放|产品|copilot|cursor|claude|chatgpt|openai|gemini|deepseek|qwen|千问|商业|付费|订阅|平台|应用)/i.test(
        text,
      );
    case "agent":
      return /(agent|智能体|工具|workflow|工作流|自动化|mcp|插件|开发者|编程|代码|ide|copilot)/i.test(
        text,
      );
    case "video":
      return post.type === "video";
    case "research":
      return /(论文|研究|评测|benchmark|基准|实验|推理|训练|模型能力|arxiv|paper|safety|安全|对齐)/i.test(
        text,
      );
    default:
      return true;
  }
}

export function getPostPublishedSortTime(post: Post) {
  const createdAt = new Date(post.createdAt).getTime();
  if (Number.isFinite(createdAt)) {
    if (hasUntrustedDouyinPublishTime(post, createdAt)) {
      return createdAt - 7 * 24 * 60 * 60 * 1000;
    }

    return createdAt;
  }

  const collectedAt = new Date(post.collectedAt ?? "").getTime();
  return Number.isFinite(collectedAt) ? collectedAt : 0;
}

function hasUntrustedDouyinPublishTime(post: Post, createdAt: number) {
  if (post.type !== "video") return false;
  if (!post.sourceId?.startsWith("douyin-")) return false;

  const collectedAt = new Date(post.collectedAt ?? "").getTime();
  if (!Number.isFinite(collectedAt)) return true;

  return Math.abs(createdAt - collectedAt) < 2 * 60 * 1000;
}

function getPostHeat(post: Post) {
  return Math.max(0, post.likesCount) + Math.max(0, post.commentsCount) * 2;
}

function isRecentPost(post: Post, maxHours: number) {
  const time = getPostPublishedSortTime(post);
  if (!Number.isFinite(time) || time <= 0) return false;
  return Date.now() - time <= maxHours * 60 * 60 * 1000;
}

function scoreFreshness(post: Post, now: number) {
  const time = getPostPublishedSortTime(post);
  if (!Number.isFinite(time) || time <= 0) return 0;

  const ageHours = (now - time) / (60 * 60 * 1000);
  if (ageHours <= 6) return 1.1;
  if (ageHours <= 24) return 0.8;
  if (ageHours <= 72) return 0.35;
  return -0.4;
}

function scoreSourceAuthority(post: Post) {
  const text = `${post.sourceName} ${post.tags.join(" ")}`.toLowerCase();
  if (/(openai|anthropic|deepmind|google|nvidia|microsoft|官方)/i.test(text)) return 0.8;
  if (/(量子位|36氪|it之家|机器之心|新智元)/i.test(text)) return 0.45;
  if (post.type === "video") return -0.15;
  return 0;
}
