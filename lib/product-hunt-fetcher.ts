import type { WorkItem, WorkSource, WorkType } from "@/lib/interesting-works";

type ProductHuntPost = {
  id?: string;
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  website?: string;
  votesCount?: number;
  commentsCount?: number;
  createdAt?: string;
  featuredAt?: string;
  thumbnail?: {
    url?: string;
  };
  media?: Array<{
    type?: string;
    url?: string;
    videoUrl?: string;
  }>;
  topics?: {
    edges?: Array<{
      node?: {
        name?: string;
        slug?: string;
      };
    }>;
  };
  makers?: Array<{
    name?: string;
    username?: string;
    profileImage?: string;
  }>;
};

type ProductHuntApiResponse = {
  data?: {
    posts?: {
      edges?: Array<{
        node?: ProductHuntPost;
      }>;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

export type ProductHuntFetchResult = {
  ok: boolean;
  source: WorkSource;
  count: number;
  works: WorkItem[];
  error?: string;
};

const PRODUCT_HUNT_API_URL = "https://api.producthunt.com/v2/api/graphql";
const PRODUCT_HUNT_SOURCE: WorkSource = "producthunt";
const aiKeywords = [
  "ai",
  "artificial intelligence",
  "agent",
  "chatbot",
  "llm",
  "gpt",
  "automation",
  "copilot",
  "prompt",
  "image generation",
  "video generation",
  "design tool",
  "developer tool",
  "productivity",
  "machine learning",
];
const lowQualityKeywords = [
  "directory",
  "list of ai tools",
  "tools directory",
  "coupon",
  "newsletter directory",
  "submit your ai",
];

export async function fetchProductHuntWorks({
  weeklyLimit = 50,
  dailyLimit = 20,
}: {
  weeklyLimit?: number;
  dailyLimit?: number;
} = {}): Promise<ProductHuntFetchResult> {
  const token = process.env.PRODUCT_HUNT_TOKEN || process.env.PRODUCTHUNT_TOKEN;

  if (!token) {
    return {
      ok: false,
      source: PRODUCT_HUNT_SOURCE,
      count: 0,
      works: [],
      error: "PRODUCT_HUNT_TOKEN is not configured",
    };
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [weeklyPosts, dailyPosts] = await Promise.all([
      fetchProductHuntPosts({
        token,
        first: weeklyLimit,
        postedAfter: weekAgo,
      }),
      fetchProductHuntPosts({
        token,
        first: dailyLimit,
        postedAfter: dayAgo,
      }),
    ]);
    const postMap = new Map<string, ProductHuntPost>();

    for (const post of [...weeklyPosts, ...dailyPosts]) {
      if (!post.id) continue;
      postMap.set(post.id, post);
    }

    const works = Array.from(postMap.values())
      .filter(shouldKeepProductHuntPost)
      .map(productHuntPostToWork)
      .sort((a, b) => b.heatScore - a.heatScore)
      .slice(0, weeklyLimit);

    return {
      ok: true,
      source: PRODUCT_HUNT_SOURCE,
      count: works.length,
      works,
    };
  } catch (error) {
    return {
      ok: false,
      source: PRODUCT_HUNT_SOURCE,
      count: 0,
      works: [],
      error: error instanceof Error ? error.message : "Product Hunt fetch failed",
    };
  }
}

async function fetchProductHuntPosts({
  token,
  first,
  postedAfter,
}: {
  token: string;
  first: number;
  postedAfter: Date;
}) {
  const response = await fetch(PRODUCT_HUNT_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 ProductHunt ingest",
    },
    body: JSON.stringify({
      query: `
        query ProductHuntAiWorks($first: Int!, $postedAfter: DateTime!) {
          posts(first: $first, order: VOTES, postedAfter: $postedAfter) {
            edges {
              node {
                id
                name
                tagline
                description
                url
                website
                votesCount
                commentsCount
                createdAt
                featuredAt
                thumbnail { url }
                media { type url videoUrl }
                topics { edges { node { name slug } } }
                makers { name username profileImage }
              }
            }
          }
        }
      `,
      variables: {
        first,
        postedAfter: postedAfter.toISOString(),
      },
    }),
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Product Hunt API HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = JSON.parse(text) as ProductHuntApiResponse;
  const apiError = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");

  if (apiError) {
    throw new Error(apiError);
  }

  return payload.data?.posts?.edges?.map((edge) => edge.node).filter(isProductHuntPost) ?? [];
}

function isProductHuntPost(value: ProductHuntPost | undefined): value is ProductHuntPost {
  return Boolean(value);
}

function shouldKeepProductHuntPost(post: ProductHuntPost) {
  const text = [
    post.name,
    post.tagline,
    post.description,
    ...readTopicTexts(post),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const votesCount = Number(post.votesCount ?? 0);
  const commentsCount = Number(post.commentsCount ?? 0);
  const hasAiSignal = aiKeywords.some((keyword) => text.includes(keyword));
  const isLowQualityDirectory = lowQualityKeywords.some((keyword) => text.includes(keyword));
  const hasEnoughAttention = votesCount >= 20 || commentsCount >= 5;

  return hasAiSignal && hasEnoughAttention && !isLowQualityDirectory;
}

function productHuntPostToWork(post: ProductHuntPost): WorkItem {
  const topics = readTopicTexts(post);
  const title = cleanText(post.name) || "Untitled Product Hunt AI product";
  const createdAt = normalizeDate(post.featuredAt || post.createdAt);
  const media = post.media ?? [];
  const videoMedia = media.find((item) => item.videoUrl || item.type?.toLowerCase() === "video");
  const maker = post.makers?.[0];
  const externalUrl = post.website || post.url || "https://www.producthunt.com/";
  const coverUrl =
    normalizeImageUrl(post.thumbnail?.url) ||
    normalizeImageUrl(media.find((item) => item.url)?.url) ||
    fallbackCoverUrl(title, topics);
  const type = inferWorkType(post);
  const likeCount = Number(post.votesCount ?? 0);
  const commentCount = Number(post.commentsCount ?? 0);
  const heatScore = calculateHeatScore(post);

  return {
    id: `producthunt-${slugify(post.id || title)}`,
    title,
    description: cleanText(post.tagline || post.description) || "来自 Product Hunt 的 AI 产品。",
    whyInteresting: buildWhyInteresting(post, type),
    type,
    source: PRODUCT_HUNT_SOURCE,
    coverUrl,
    mediaUrls: media.map((item) => item.url).filter((url): url is string => Boolean(url)),
    videoUrl: videoMedia?.videoUrl,
    externalUrl,
    authorName: maker?.name,
    authorAvatar: maker?.profileImage,
    originalAuthorUrl: maker?.username
      ? `https://www.producthunt.com/@${maker.username}`
      : undefined,
    toolNames: readToolNames(post),
    tags: buildTags(post, type),
    status: "approved",
    featured: heatScore >= 85,
    sourceVerified: true,
    viewCount: Math.max(likeCount * 18 + commentCount * 45, likeCount),
    likeCount,
    favoriteCount: Math.round(likeCount * 0.42),
    commentCount,
    clickCount: Math.max(Math.round(likeCount * 2.4), commentCount),
    heatScore,
    createdAt,
    publishedAt: createdAt,
  };
}

function inferWorkType(post: ProductHuntPost): WorkType {
  const text = [post.name, post.tagline, post.description, ...readTopicTexts(post)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("github") || text.includes("open source")) return "github";
  if (text.includes("prompt")) return "prompt";
  if (text.includes("workflow") || text.includes("automation")) return "workflow";
  if (text.includes("mobile") || text.includes("ios") || text.includes("android")) return "app";
  if (text.includes("video")) return "video";
  if (text.includes("image") || text.includes("design") || text.includes("poster")) return "image";
  return "website";
}

function buildWhyInteresting(post: ProductHuntPost, type: WorkType) {
  const votes = Number(post.votesCount ?? 0);
  const comments = Number(post.commentsCount ?? 0);
  const topic = readTopicTexts(post)[0] ?? "AI 产品";
  const typeText: Record<WorkType, string> = {
    image: "它把 AI 视觉能力包装成可直接体验的产品形态",
    video: "它把 AI 视频能力变成了可展示、可传播的真实产品",
    website: "它是可以直接访问体验的 AI Web App",
    app: "它把 AI 能力放进了更贴近日常使用的 App 场景",
    prompt: "它把可复刻的 Prompt 能力产品化了",
    workflow: "它把多个 AI 步骤串成了可执行流程",
    github: "它提供了可查看源码和继续二次开发的实现路径",
  };

  return `${typeText[type]}，并且在 Product Hunt 获得 ${votes} 个赞和 ${comments} 条评论，说明 ${topic} 方向已经有人真实关注。`;
}

function buildTags(post: ProductHuntPost, type: WorkType) {
  const topicTags = readTopicTexts(post)
    .map((topic) => topic.replace(/\s+/g, " "))
    .slice(0, 4);
  const baseTags = ["Product Hunt", "AI产品", type === "website" ? "网页应用" : typeLabel(type)];

  return Array.from(new Set([...baseTags, ...topicTags])).slice(0, 6);
}

function readToolNames(post: ProductHuntPost) {
  const topics = readTopicTexts(post);
  const tools = ["Product Hunt", ...topics.filter((topic) => /ai|agent|design|developer/i.test(topic))];
  return Array.from(new Set(tools)).slice(0, 4);
}

function readTopicTexts(post: ProductHuntPost) {
  return (
    post.topics?.edges
      ?.map((edge) => edge.node?.name || edge.node?.slug)
      .filter((topic): topic is string => Boolean(topic)) ?? []
  );
}

function calculateHeatScore(post: ProductHuntPost) {
  const votes = Number(post.votesCount ?? 0);
  const comments = Number(post.commentsCount ?? 0);
  return Math.max(62, Math.min(99, Math.round(62 + Math.log10(votes + 10) * 12 + comments * 0.35)));
}

function cleanText(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeDate(value?: string) {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeImageUrl(value?: string) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function fallbackCoverUrl(title: string, topics: string[]) {
  return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `modern AI product website screenshot, ${title}, ${topics.join(", ")}, clean SaaS interface, product hunt style, high quality`,
  )}&image_size=landscape_16_9`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function typeLabel(type: WorkType) {
  const labels: Record<WorkType, string> = {
    image: "AI图片",
    video: "AI视频",
    website: "网站",
    app: "App",
    prompt: "Prompt",
    workflow: "工作流",
    github: "开源项目",
  };

  return labels[type];
}
