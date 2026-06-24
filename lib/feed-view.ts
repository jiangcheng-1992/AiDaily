import type { Post } from "@/lib/mock-data";
import { calculatePostScore } from "@/lib/post-score";

export type HomeChannelId =
  | "all"
  | "hot"
  | "drama"
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
  { id: "drama", label: "AI短剧", description: "AI 短剧、AI 影视、海外短剧市场和成片案例" },
  { id: "product", label: "产品发布", description: "模型、应用、平台和商业化动态" },
  { id: "agent", label: "Agent/工具", description: "智能体、开发工具和工作流" },
  { id: "video", label: "视频", description: "B站、YouTube、抖音视频动态" },
  { id: "research", label: "研究/论文", description: "论文、评测、基准和技术研究" },
];

export function buildHomeFeedPosts(posts: Post[]) {
  return posts.filter((post) => post.type !== "skill" && isAiRelevantPost(post)).sort(sortHomePosts);
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
        scoreSourceAuthority(post),
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
    case "drama":
      return isAiDramaPost(post);
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
  return 0;
}

function isAiDramaPost(post: Post) {
  const text = `${post.title} ${post.summary} ${post.whyItMatters} ${post.editorComment} ${post.tags.join(" ")} ${
    post.sourceName
  }`.toLowerCase();

  return /(ai短剧|ai 剧|ai剧|aigc短剧|ai影视|ai 影视|ai电影|ai短片|ai成片|短剧|微短剧|竖屏剧|漫剧|影视生成|视频生成|sora|runway|kling|可灵|veo|hailuo|海螺|pika|luma|ai drama|ai short film|ai film|ai filmmaking|ai filmmaker|ai cinema|ai video|short drama|micro drama|mini drama|vertical drama|web drama|web series|short-form drama|reelshort)/i.test(
    text,
  );
}

function isAiRelevantPost(post: Post) {
  const text = `${post.title} ${post.summary} ${post.whyItMatters} ${post.editorComment} ${post.tags.join(" ")} ${
    post.sourceName
  }`.toLowerCase();

  const hasAiSignal =
    /(ai|aigc|agi|agent|llm|gpt|chatgpt|openai|claude|gemini|deepseek|qwen|sora|midjourney|stable diffusion|copilot|cursor|mcp|prompt|大模型|模型|智能体|人工智能|生成式|机器学习|深度学习|神经网络|算力|推理|训练|多模态|机器人|自动化|提示词|智能|图像生成|视频生成|语音生成|短剧|微短剧|ai影视|影视生成|ai short film|ai drama|ai filmmaking|vertical drama)/i.test(
      text,
    );

  if (hasAiSignal) return true;

  const clearlyOffTopic =
    /(nba|足球|篮球|体育|赛事|综艺|明星|演唱会|电影票房|娱乐八卦|电商大促|直播带货|房产|装修|旅游|美食|穿搭|母婴|汽车降价|股票荐股|彩票|博彩|网红带货)/i.test(
      text,
    );

  return !clearlyOffTopic && post.featured === true;
}
