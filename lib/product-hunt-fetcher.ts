import { generateMiniMaxText, hasMiniMaxTextAccess } from "@/lib/minimax-text";
import type { WorkItem, WorkSource, WorkType } from "@/lib/interesting-works";

type ProductHuntPost = {
  id?: string;
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
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

type ProductHuntWorkCopy = {
  title: string;
  description: string;
  whyInteresting: string;
  tags: string[];
  toolNames: string[];
  coverPrompt: string;
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
const PRODUCT_HUNT_MAX_QUERY_LIMIT = 20;
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
    const weeklyPosts = await fetchProductHuntPosts({
      token,
      first: weeklyLimit,
      postedAfter: weekAgo,
    });
    const dailyPosts = await fetchProductHuntPosts({
      token,
      first: dailyLimit,
      postedAfter: dayAgo,
    });
    const postMap = new Map<string, ProductHuntPost>();

    for (const post of [...weeklyPosts, ...dailyPosts]) {
      if (!post.id) continue;
      postMap.set(post.id, post);
    }

    const keptPosts = Array.from(postMap.values())
      .filter(shouldKeepProductHuntPost)
      .sort((a, b) => calculateHeatScore(b) - calculateHeatScore(a))
      .slice(0, weeklyLimit);
    const works = await mapWithConcurrency(keptPosts, 2, productHuntPostToWork);

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
  const safeFirst = Math.min(Math.max(first, 1), PRODUCT_HUNT_MAX_QUERY_LIMIT);
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
          posts(first: $first, postedAfter: $postedAfter) {
            edges {
              node {
                id
                name
                tagline
                description
                url
                votesCount
                commentsCount
                createdAt
                featuredAt
                thumbnail { url }
              }
            }
          }
        }
      `,
      variables: {
        first: safeFirst,
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

async function productHuntPostToWork(post: ProductHuntPost): Promise<WorkItem> {
  const originalTitle = cleanText(post.name) || "Untitled Product Hunt AI product";
  const createdAt = normalizeDate(post.featuredAt || post.createdAt);
  const media = post.media ?? [];
  const videoMedia = media.find((item) => item.videoUrl || item.type?.toLowerCase() === "video");
  const externalUrl = post.url || "https://www.producthunt.com/";
  const type = inferWorkType(post);
  const copy = await buildChineseProductHuntCopy(post, type);
  const title = copy.title;
  const coverUrl =
    normalizeImageUrl(post.thumbnail?.url) ||
    normalizeImageUrl(media.find((item) => item.url)?.url) ||
    fallbackCoverUrl({
      title: originalTitle,
      description: copy.description,
      type,
      coverPrompt: copy.coverPrompt,
    });
  const likeCount = Number(post.votesCount ?? 0);
  const commentCount = Number(post.commentsCount ?? 0);
  const heatScore = calculateHeatScore(post);

  return {
    id: `producthunt-${slugify(post.id || title)}`,
    title,
    description: copy.description,
    whyInteresting: copy.whyInteresting,
    type,
    source: PRODUCT_HUNT_SOURCE,
    coverUrl,
    mediaUrls: media.map((item) => item.url).filter((url): url is string => Boolean(url)),
    videoUrl: videoMedia?.videoUrl,
    externalUrl,
    authorName: "Product Hunt",
    originalAuthorUrl: "https://www.producthunt.com/",
    toolNames: copy.toolNames,
    tags: copy.tags,
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

async function buildChineseProductHuntCopy(
  post: ProductHuntPost,
  type: WorkType,
): Promise<ProductHuntWorkCopy> {
  const fallback = buildLocalChineseProductHuntCopy(post, type);

  if (!hasMiniMaxTextAccess()) {
    return fallback;
  }

  try {
    const text = await generateMiniMaxText({
      systemPrompt:
        "你是「AI圈」有点意思频道的中文产品编辑。请把 Product Hunt 英文产品信息改写成中文作品卡片 JSON。必须只基于输入信息，不编造官网没有提供的能力；文案要直接说明这个作品、网站或工作流是做什么的，适合谁用，为什么有意思。只输出 JSON。",
      userPrompt: JSON.stringify({
        task: "把 Product Hunt 产品转成中文作品流卡片",
        constraints: [
          "title 保留原产品名，并用中文说明用途，格式类似「产品名：用 AI 做什么」，不超过 32 个中文字符。",
          "description 用 45 到 95 个中文字符讲清它具体解决什么问题，不能只写营销口号。",
          "whyInteresting 用 70 到 150 个中文字符说明它为什么值得放进有点意思，必须结合 votesCount/commentsCount 或具体场景。",
          "tags 输出 3 到 6 个中文标签，可包含 Product Hunt、AI产品、网页应用、Agent、设计工具、开发工具、效率工具等。",
          "toolNames 输出 2 到 4 个工具/平台名，必须包含 Product Hunt。",
          "coverPrompt 输出英文 SDXL 封面提示词，描述一个与产品用途对应的真实网站/应用界面封面，不要写文字水印。",
        ],
        product: {
          name: post.name,
          tagline: post.tagline,
          description: post.description,
          type,
          votesCount: post.votesCount,
          commentsCount: post.commentsCount,
        },
        outputShape: {
          title: "产品名：中文用途",
          description: "一句中文说明",
          whyInteresting: "为什么有意思",
          tags: ["Product Hunt", "AI产品", "网页应用"],
          toolNames: ["Product Hunt", "AI"],
          coverPrompt: "realistic SaaS web app dashboard cover, ...",
        },
      }),
      temperature: 0.25,
    });

    return sanitizeProductHuntCopy(parseProductHuntCopy(text), fallback);
  } catch (error) {
    console.warn("[producthunt] Chinese copy generation fell back to local copy", {
      productId: post.id,
      productName: post.name,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return fallback;
  }
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

function buildLocalChineseProductHuntCopy(
  post: ProductHuntPost,
  type: WorkType,
): ProductHuntWorkCopy {
  const productName = cleanText(post.name) || "Product Hunt AI 产品";
  const originalDescription = cleanText(post.tagline || post.description);
  const useCase = inferChineseUseCase(post, type);
  const typeText = typeLabel(type);
  const votes = Number(post.votesCount ?? 0);
  const comments = Number(post.commentsCount ?? 0);
  const title = clip(`${productName}：${useCase}`, 42);
  const description = originalDescription
    ? clip(`这是一个来自 Product Hunt 的${typeText}，主打${useCase}。原始介绍：${originalDescription}`, 110)
    : `这是一个来自 Product Hunt 的${typeText}，主要帮助用户${useCase}。`;

  return {
    title,
    description,
    whyInteresting: `它把「${useCase}」包装成可直接体验的产品形态，并在 Product Hunt 获得 ${votes} 个赞和 ${comments} 条评论，适合用来观察 AI 产品的新场景和真实需求。`,
    tags: Array.from(new Set(["Product Hunt", "AI产品", typeText, inferUseCaseTag(post)])).slice(0, 6),
    toolNames: Array.from(new Set(["Product Hunt", ...readToolNames(post), inferToolName(post)])).slice(0, 4),
    coverPrompt: buildCoverPrompt(productName, useCase, type),
  };
}

function parseProductHuntCopy(value: string): Partial<ProductHuntWorkCopy> {
  const cleanValue = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleanValue) as Partial<ProductHuntWorkCopy>;
}

function sanitizeProductHuntCopy(
  value: Partial<ProductHuntWorkCopy>,
  fallback: ProductHuntWorkCopy,
): ProductHuntWorkCopy {
  return {
    title: clip(cleanText(value.title) || fallback.title, 48),
    description: clip(cleanText(value.description) || fallback.description, 120),
    whyInteresting: clip(cleanText(value.whyInteresting) || fallback.whyInteresting, 180),
    tags: sanitizeStringArray(value.tags, fallback.tags, 6),
    toolNames: sanitizeStringArray(value.toolNames, fallback.toolNames, 4),
    coverPrompt: cleanText(value.coverPrompt) || fallback.coverPrompt,
  };
}

function sanitizeStringArray(value: unknown, fallback: string[], limit: number) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => cleanText(String(item))).filter(Boolean);
  return Array.from(new Set(items.length ? items : fallback)).slice(0, limit);
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

function fallbackCoverUrl({
  title,
  description,
  type,
  coverPrompt,
}: {
  title: string;
  description: string;
  type: WorkType;
  coverPrompt: string;
}) {
  const visualPrompt =
    coverPrompt ||
    `realistic ${typeLabel(type)} cover for ${title}, ${description}, clean SaaS web app interface, premium product hunt style, high quality`;
  return buildSvgCoverUrl({
    title,
    subtitle: inferCoverSubtitle(description, visualPrompt),
    type,
  });
}

function buildSvgCoverUrl({
  title,
  subtitle,
  type,
}: {
  title: string;
  subtitle: string;
  type: WorkType;
}) {
  const colors = coverColorsByType[type];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.from}"/>
      <stop offset="55%" stop-color="${colors.mid}"/>
      <stop offset="100%" stop-color="${colors.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="18%" r="62%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.38)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="rgba(15,23,42,0.34)"/>
    </filter>
  </defs>
  <rect width="1200" height="675" rx="44" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <g opacity="0.18">
    <path d="M0 114H1200M0 228H1200M0 342H1200M0 456H1200M0 570H1200M150 0V675M300 0V675M450 0V675M600 0V675M750 0V675M900 0V675M1050 0V675" stroke="white" stroke-width="1"/>
  </g>
  <circle cx="988" cy="118" r="132" fill="rgba(255,255,255,0.14)"/>
  <circle cx="1022" cy="144" r="74" fill="rgba(255,255,255,0.12)"/>
  <rect x="86" y="86" width="1028" height="503" rx="38" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.36)" filter="url(#shadow)"/>
  <rect x="132" y="139" width="430" height="46" rx="23" fill="rgba(255,255,255,0.22)"/>
  <rect x="132" y="229" width="620" height="52" rx="26" fill="rgba(255,255,255,0.88)"/>
  <rect x="132" y="314" width="488" height="26" rx="13" fill="rgba(255,255,255,0.54)"/>
  <rect x="132" y="358" width="390" height="26" rx="13" fill="rgba(255,255,255,0.42)"/>
  <rect x="132" y="456" width="182" height="58" rx="29" fill="rgba(15,23,42,0.86)"/>
  <rect x="734" y="214" width="280" height="260" rx="34" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.32)"/>
  <path d="M794 352C846 292 905 286 960 352C913 408 848 409 794 352Z" fill="rgba(255,255,255,0.74)"/>
  <circle cx="877" cy="350" r="36" fill="${colors.mid}"/>
  <text x="132" y="174" fill="rgba(255,255,255,0.86)" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800">${escapeSvgText(typeLabel(type))} · Product Hunt</text>
  <text x="132" y="268" fill="#0f172a" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900">${escapeSvgText(clip(title, 30))}</text>
  <text x="132" y="333" fill="rgba(255,255,255,0.88)" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">${escapeSvgText(clip(subtitle, 38))}</text>
  <text x="173" y="493" fill="white" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900">AI 圈精选</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

const coverColorsByType: Record<WorkType, { from: string; mid: string; to: string }> = {
  image: { from: "#7c3aed", mid: "#db2777", to: "#f59e0b" },
  video: { from: "#0f172a", mid: "#2563eb", to: "#06b6d4" },
  website: { from: "#172554", mid: "#4f46e5", to: "#a855f7" },
  app: { from: "#064e3b", mid: "#059669", to: "#22d3ee" },
  prompt: { from: "#3b0764", mid: "#7e22ce", to: "#f97316" },
  workflow: { from: "#111827", mid: "#0ea5e9", to: "#14b8a6" },
  github: { from: "#020617", mid: "#334155", to: "#6366f1" },
};

function inferCoverSubtitle(description: string, visualPrompt: string) {
  const source = cleanText(description) || cleanText(visualPrompt);
  return source || "一个值得体验的 AI 产品";
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inferChineseUseCase(post: ProductHuntPost, type: WorkType) {
  const text = [post.name, post.tagline, post.description].filter(Boolean).join(" ").toLowerCase();

  if (/agent|assistant|chatbot|copilot/.test(text)) return "搭建或使用 AI Agent 助手";
  if (/design|ui|brand|logo|image|poster/.test(text)) return "生成设计素材和视觉内容";
  if (/video|clip|short|reel/.test(text)) return "生成或处理 AI 视频内容";
  if (/code|developer|github|api|sdk/.test(text)) return "提升开发和代码协作效率";
  if (/meeting|calendar|email|doc|note|productivity/.test(text)) return "自动处理办公和效率任务";
  if (/workflow|automation|zapier|integrat/.test(text)) return "把重复工作串成自动化流程";
  if (/search|research|knowledge|browser/.test(text)) return "做资料搜索、研究和知识整理";

  const fallback: Record<WorkType, string> = {
    image: "生成 AI 图片和视觉内容",
    video: "生成或处理 AI 视频内容",
    website: "在线体验一个 AI 网页应用",
    app: "在移动端使用 AI 能力",
    prompt: "复用一套高质量 Prompt",
    workflow: "把多个 AI 步骤串成工作流",
    github: "查看和复用开源 AI 项目",
  };

  return fallback[type];
}

function inferUseCaseTag(post: ProductHuntPost) {
  const text = [post.name, post.tagline, post.description].filter(Boolean).join(" ").toLowerCase();

  if (/agent|assistant|chatbot|copilot/.test(text)) return "Agent";
  if (/design|ui|brand|logo|image|poster/.test(text)) return "设计工具";
  if (/video|clip|short|reel/.test(text)) return "视频工具";
  if (/code|developer|github|api|sdk/.test(text)) return "开发工具";
  if (/meeting|calendar|email|doc|note|productivity/.test(text)) return "效率工具";
  if (/workflow|automation|zapier|integrat/.test(text)) return "工作流";
  if (/search|research|knowledge|browser/.test(text)) return "知识工具";
  return "可体验项目";
}

function inferToolName(post: ProductHuntPost) {
  const text = [post.name, post.tagline, post.description].filter(Boolean).join(" ").toLowerCase();

  if (/agent|assistant|chatbot|copilot/.test(text)) return "AI Agent";
  if (/design|ui|brand|logo|image|poster/.test(text)) return "AI Design";
  if (/video|clip|short|reel/.test(text)) return "AI Video";
  if (/code|developer|github|api|sdk/.test(text)) return "Developer Tool";
  return "AI Web App";
}

function buildCoverPrompt(productName: string, useCase: string, type: WorkType) {
  return [
    "realistic premium SaaS product cover",
    `${productName} AI product`,
    useCase,
    typeLabel(type),
    "clean web app dashboard interface",
    "modern cards, subtle gradients, high quality, no text watermark",
  ].join(", ");
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

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
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
