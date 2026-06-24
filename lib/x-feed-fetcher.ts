import type { Post, PostType } from "@/lib/mock-data";
import { buildGeneratedPostId } from "@/lib/post-identity";

export type RawXPost = {
  id: string;
  url: string;
  text: string;
  lang: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    name: string;
    verified?: boolean;
    description?: string;
    profileImageUrl?: string;
  };
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views?: number;
    bookmarks?: number;
  };
  entities?: {
    urls?: Array<{
      url: string;
      expandedUrl: string;
      displayUrl: string;
      title?: string;
      description?: string;
      images?: string[];
    }>;
    hashtags?: string[];
    mentions?: string[];
  };
  media?: Array<{
    type: "photo" | "video" | "animated_gif";
    url?: string;
    previewImageUrl?: string;
    durationMs?: number;
  }>;
  referencedPosts?: Array<{
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }>;
  sourceType: "whitelist_user" | "keyword_search" | "filtered_stream";
  fetchedAt: string;
};

export type XIngestDiagnostics = {
  configured: boolean;
  sourceCount: number;
  keywordQueryCount: number;
  rawCount: number;
  normalizedCount: number;
  passedFilterCount: number;
  rejectionReasonCounts: Record<string, number>;
  sourceDiagnostics: Array<{
    source: string;
    group: XSourceGroup;
    rawCount: number;
    passedCount: number;
    rejectionReasonCounts: Record<string, number>;
  }>;
  errors: Array<{ source: string; error: string }>;
};

export type XFeedRun = {
  ok: boolean;
  count: number;
  posts: Post[];
  diagnostics: XIngestDiagnostics;
  error?: string;
};

type XSourceGroup = "official" | "researcher" | "developer" | "media" | "chinese";

type XAuthorType = "official" | "researcher" | "founder" | "developer" | "media" | "creator";

type XWhitelistAccount = {
  username: string;
  name: string;
  group: XSourceGroup;
  authorType: XAuthorType;
  authorityScore: number;
  tags: string[];
};

type XApiTweet = {
  id: string;
  text: string;
  lang?: string;
  created_at?: string;
  author_id?: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url?: string;
      display_url?: string;
      title?: string;
      description?: string;
      images?: Array<{ url?: string }>;
    }>;
    hashtags?: Array<{ tag?: string }>;
    mentions?: Array<{ username?: string }>;
  };
  attachments?: {
    media_keys?: string[];
  };
  referenced_tweets?: Array<{
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }>;
};

type XApiUser = {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
  description?: string;
  profile_image_url?: string;
};

type XApiMedia = {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  duration_ms?: number;
};

const X_API_BASE = "https://api.twitter.com/2";

const includeSignals = [
  "launch",
  "released",
  "release",
  "introducing",
  "open source",
  "open-source",
  "paper",
  "benchmark",
  "api",
  "agent",
  "model",
  "multimodal",
  "reasoning",
  "video",
  "ai video market",
  "ai short film",
  "ai filmmaking",
  "ai filmmaker",
  "ai drama",
  "ai series",
  "short drama",
  "micro drama",
  "mini drama",
  "vertical drama",
  "web series",
  "short-form drama",
  "creator economy",
  "coding",
  "workflow",
  "case study",
  "rag",
  "mcp",
  "llm",
  "ai",
  "大模型",
  "多模态",
  "开源模型",
  "推理模型",
  "AI视频",
  "AI短剧",
  "微短剧",
  "短剧",
  "AI影视",
  "AI编程",
  "智能体",
];

const excludeKeywords = [
  "airdrop",
  "crypto giveaway",
  "meme coin",
  "onlyfans",
  "nsfw",
  "prompt leak",
  "jailbreak",
  "earn money fast",
  "fake trailer",
  "fan trailer",
  "giveaway",
  "web3 giveaway",
  "100x",
  "pump",
];

const whitelistAccounts: XWhitelistAccount[] = [
  { username: "OpenAI", name: "OpenAI", group: "official", authorType: "official", authorityScore: 10, tags: ["OpenAI", "模型"] },
  { username: "AnthropicAI", name: "Anthropic", group: "official", authorType: "official", authorityScore: 10, tags: ["Anthropic", "Claude"] },
  { username: "GoogleDeepMind", name: "Google DeepMind", group: "official", authorType: "official", authorityScore: 10, tags: ["DeepMind", "研究"] },
  { username: "GoogleAI", name: "Google AI", group: "official", authorType: "official", authorityScore: 10, tags: ["Google AI"] },
  { username: "MSFTCopilot", name: "Microsoft AI", group: "official", authorType: "official", authorityScore: 9, tags: ["Microsoft", "Copilot"] },
  { username: "AIatMeta", name: "Meta AI", group: "official", authorType: "official", authorityScore: 9, tags: ["Meta AI", "开源"] },
  { username: "xai", name: "xAI", group: "official", authorType: "official", authorityScore: 9, tags: ["xAI"] },
  { username: "perplexity_ai", name: "Perplexity", group: "official", authorType: "official", authorityScore: 9, tags: ["搜索", "AI产品"] },
  { username: "MistralAI", name: "Mistral AI", group: "official", authorType: "official", authorityScore: 9, tags: ["开源模型"] },
  { username: "cohere", name: "Cohere", group: "official", authorType: "official", authorityScore: 8, tags: ["企业AI"] },
  { username: "huggingface", name: "Hugging Face", group: "developer", authorType: "developer", authorityScore: 8, tags: ["开源", "模型"] },
  { username: "runwayml", name: "Runway", group: "official", authorType: "official", authorityScore: 8, tags: ["AI视频"] },
  { username: "LumaLabsAI", name: "Luma AI", group: "official", authorType: "official", authorityScore: 8, tags: ["AI视频"] },
  { username: "pika_labs", name: "Pika", group: "official", authorType: "official", authorityScore: 8, tags: ["AI视频"] },
  { username: "TechCrunch", name: "TechCrunch", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "新闻", "AI短剧市场"] },
  { username: "VentureBeat", name: "VentureBeat AI", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "新闻", "AI视频市场"] },
  { username: "midjourney", name: "Midjourney", group: "official", authorType: "official", authorityScore: 8, tags: ["AI图片"] },
  { username: "StabilityAI", name: "Stability AI", group: "official", authorType: "official", authorityScore: 8, tags: ["开源模型"] },
  { username: "elevenlabsio", name: "ElevenLabs", group: "official", authorType: "official", authorityScore: 8, tags: ["AI音频"] },
  { username: "cursor_ai", name: "Cursor", group: "developer", authorType: "developer", authorityScore: 8, tags: ["AI编程"] },
  { username: "Replit", name: "Replit", group: "developer", authorType: "developer", authorityScore: 8, tags: ["开发者"] },
  { username: "vercel", name: "Vercel", group: "developer", authorType: "developer", authorityScore: 8, tags: ["Vercel", "AI开发"] },
  { username: "LangChainAI", name: "LangChain", group: "developer", authorType: "developer", authorityScore: 8, tags: ["Agent", "RAG"] },
  { username: "weights_biases", name: "Weights & Biases", group: "developer", authorType: "developer", authorityScore: 8, tags: ["MLOps"] },
  { username: "sama", name: "Sam Altman", group: "researcher", authorType: "founder", authorityScore: 9, tags: ["观点", "OpenAI"] },
  { username: "gdb", name: "Greg Brockman", group: "researcher", authorType: "founder", authorityScore: 9, tags: ["OpenAI"] },
  { username: "AndrewYNg", name: "Andrew Ng", group: "researcher", authorType: "researcher", authorityScore: 9, tags: ["AI教育", "Agent"] },
  { username: "ylecun", name: "Yann LeCun", group: "researcher", authorType: "researcher", authorityScore: 9, tags: ["研究", "模型"] },
  { username: "karpathy", name: "Andrej Karpathy", group: "researcher", authorType: "researcher", authorityScore: 9, tags: ["AI编程", "模型"] },
  { username: "DrJimFan", name: "Jim Fan", group: "researcher", authorType: "researcher", authorityScore: 9, tags: ["Agent", "机器人"] },
  { username: "drfeifei", name: "Fei-Fei Li", group: "researcher", authorType: "researcher", authorityScore: 9, tags: ["研究"] },
  { username: "rasbt", name: "Sebastian Raschka", group: "researcher", authorType: "researcher", authorityScore: 8, tags: ["模型", "开发者"] },
  { username: "jeremyphoward", name: "Jeremy Howard", group: "researcher", authorType: "researcher", authorityScore: 8, tags: ["AI教育", "开源"] },
  { username: "hwchase17", name: "Harrison Chase", group: "developer", authorType: "founder", authorityScore: 8, tags: ["LangChain", "Agent"] },
  { username: "OfficialLoganK", name: "Logan Kilpatrick", group: "developer", authorType: "developer", authorityScore: 8, tags: ["开发者"] },
  { username: "swyx", name: "Swyx", group: "developer", authorType: "developer", authorityScore: 7, tags: ["开发者", "AI工程"] },
  { username: "emollick", name: "Ethan Mollick", group: "researcher", authorType: "researcher", authorityScore: 8, tags: ["观点", "AI教育"] },
  { username: "simonw", name: "Simon Willison", group: "developer", authorType: "developer", authorityScore: 8, tags: ["开发者", "LLM"] },
  { username: "natolambert", name: "Nathan Lambert", group: "researcher", authorType: "researcher", authorityScore: 8, tags: ["开源模型"] },
  { username: "fchollet", name: "François Chollet", group: "researcher", authorType: "researcher", authorityScore: 8, tags: ["AGI", "观点"] },
  { username: "LlamaIndex", name: "LlamaIndex", group: "developer", authorType: "developer", authorityScore: 8, tags: ["RAG", "Agent"] },
  { username: "togethercompute", name: "Together AI", group: "developer", authorType: "developer", authorityScore: 8, tags: ["模型部署"] },
  { username: "modal_labs", name: "Modal", group: "developer", authorType: "developer", authorityScore: 7, tags: ["AI基础设施"] },
  { username: "replicate", name: "Replicate", group: "developer", authorType: "developer", authorityScore: 7, tags: ["模型部署"] },
  { username: "FireworksAI_HQ", name: "Fireworks AI", group: "developer", authorType: "developer", authorityScore: 7, tags: ["推理加速"] },
  { username: "GroqInc", name: "Groq", group: "developer", authorType: "developer", authorityScore: 7, tags: ["推理加速"] },
  { username: "ollama", name: "Ollama", group: "developer", authorType: "developer", authorityScore: 8, tags: ["本地模型"] },
  { username: "OpenRouterAI", name: "OpenRouter", group: "developer", authorType: "developer", authorityScore: 7, tags: ["API"] },
  { username: "supabase", name: "Supabase", group: "developer", authorType: "developer", authorityScore: 7, tags: ["开发者"] },
  { username: "CloudflareDev", name: "Cloudflare Developers", group: "developer", authorType: "developer", authorityScore: 7, tags: ["开发者"] },
  { username: "github", name: "GitHub", group: "developer", authorType: "developer", authorityScore: 8, tags: ["GitHub", "开源"] },
  { username: "TechCrunch", name: "TechCrunch", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "新闻"] },
  { username: "VentureBeat", name: "VentureBeat AI", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "新闻"] },
  { username: "MITTechReview", name: "MIT Technology Review", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "研究"] },
  { username: "TheDecoderAI", name: "The Decoder", group: "media", authorType: "media", authorityScore: 8, tags: ["媒体", "新闻"] },
  { username: "jiqizhixin", name: "机器之心", group: "chinese", authorType: "media", authorityScore: 8, tags: ["中文AI", "研究"] },
  { username: "qbitai", name: "量子位", group: "chinese", authorType: "media", authorityScore: 8, tags: ["中文AI", "新闻"] },
  { username: "baoyu_io", name: "宝玉", group: "chinese", authorType: "creator", authorityScore: 7, tags: ["中文AI", "观点"] },
  { username: "op7418", name: "歸藏", group: "chinese", authorType: "creator", authorityScore: 7, tags: ["中文AI", "工具"] },
];

const keywordQueries = [
  '("AI agent" OR LLM OR multimodal OR "AI video" OR "open source model" OR RAG OR MCP OR "AI coding") lang:en -is:retweet',
  '("AI short film" OR "AI drama" OR "AI filmmaking" OR "AI video market" OR "short drama" OR "vertical drama" OR "web series") lang:en -is:retweet',
  '("AI Agent" OR 大模型 OR 多模态 OR AI视频 OR 开源模型 OR RAG OR MCP OR AI编程) lang:zh -is:retweet',
  '(AI短剧 OR AI影视 OR 微短剧 OR 短剧市场 OR 视频生成 OR Sora OR Runway OR 可灵) lang:zh -is:retweet',
  '("launched" OR "introducing" OR "released" OR "open-sourced") (AI OR LLM OR agent OR "video model") -is:retweet',
  '("paper" OR arxiv OR research) (LLM OR multimodal OR reasoning OR agent) -is:retweet',
];

export async function fetchXFeedPosts({
  sourceLimit = 24,
  itemLimit = 3,
  keywordLimit = 0,
  publishLimit = 12,
}: {
  sourceLimit?: number;
  itemLimit?: number;
  keywordLimit?: number;
  publishLimit?: number;
} = {}): Promise<XFeedRun> {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  const diagnostics: XIngestDiagnostics = {
    configured: Boolean(bearerToken),
    sourceCount: Math.max(0, sourceLimit),
    keywordQueryCount: Math.max(0, keywordLimit),
    rawCount: 0,
    normalizedCount: 0,
    passedFilterCount: 0,
    rejectionReasonCounts: {},
    sourceDiagnostics: [],
    errors: [],
  };

  if (!bearerToken) {
    return {
      ok: true,
      count: 0,
      posts: [],
      diagnostics,
      error: "X_BEARER_TOKEN is not configured; skipped X ingest.",
    };
  }

  try {
    const selectedAccounts = whitelistAccounts.slice(0, Math.max(0, sourceLimit));
    const rawPosts: RawXPost[] = [];

    for (const account of selectedAccounts) {
      try {
        const accountPosts = await fetchAccountTweets(account, {
          bearerToken,
          itemLimit,
        });
        rawPosts.push(...accountPosts);
        addSourceDiagnostics(diagnostics, account, accountPosts);
      } catch (error) {
        diagnostics.errors.push({
          source: account.username,
          error: error instanceof Error ? error.message : "Unknown X account error",
        });
      }
    }

    for (const query of keywordQueries.slice(0, Math.max(0, keywordLimit))) {
      try {
        rawPosts.push(
          ...(await fetchKeywordTweets(query, {
            bearerToken,
            itemLimit,
          })),
        );
      } catch (error) {
        diagnostics.errors.push({
          source: query,
          error: error instanceof Error ? error.message : "Unknown X keyword error",
        });
      }
    }

    diagnostics.rawCount = rawPosts.length;

    const scoredPosts = rawPosts
      .map((post) => ({ post, decision: evaluateRawPost(post) }))
      .filter(({ decision }) => {
        if (decision.shouldPublish) return true;
        incrementReason(diagnostics.rejectionReasonCounts, decision.reason);
        return false;
      })
      .sort((a, b) => b.decision.heatScore - a.decision.heatScore)
      .slice(0, Math.max(0, publishLimit));

    diagnostics.normalizedCount = rawPosts.length;
    diagnostics.passedFilterCount = scoredPosts.length;

    const posts = scoredPosts.map(({ post, decision }) => rawXPostToPost(post, decision));

    return {
      ok: diagnostics.errors.length === 0,
      count: posts.length,
      posts,
      diagnostics,
      error: diagnostics.errors[0]?.error,
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      posts: [],
      diagnostics,
      error: error instanceof Error ? error.message : "Unknown X ingest error",
    };
  }
}

async function fetchAccountTweets(
  account: XWhitelistAccount,
  {
    bearerToken,
    itemLimit,
  }: {
    bearerToken: string;
    itemLimit: number;
  },
) {
  const user = await fetchXUser(account.username, bearerToken);
  const params = buildTweetParams({
    maxResults: clamp(itemLimit, 5, 10),
    excludeRetweets: true,
  });
  const endpoint = `${X_API_BASE}/users/${user.id}/tweets?${params}`;
  const response = await fetchXJson(endpoint, bearerToken);

  return normalizeTweetsResponse(response, {
    sourceType: "whitelist_user",
    fallbackUser: {
      ...user,
      name: account.name || user.name,
    },
  }).slice(0, Math.max(0, itemLimit));
}

async function fetchKeywordTweets(
  query: string,
  {
    bearerToken,
    itemLimit,
  }: {
    bearerToken: string;
    itemLimit: number;
  },
) {
  const params = buildTweetParams({
    query,
    maxResults: clamp(itemLimit, 10, 10),
    excludeRetweets: false,
  });
  const endpoint = `${X_API_BASE}/tweets/search/recent?${params}`;
  const response = await fetchXJson(endpoint, bearerToken);

  return normalizeTweetsResponse(response, {
    sourceType: "keyword_search",
  });
}

async function fetchXUser(username: string, bearerToken: string): Promise<XApiUser> {
  const params = new URLSearchParams({
    "user.fields": "description,profile_image_url,verified",
  });
  const response = await fetchXJson(`${X_API_BASE}/users/by/username/${username}?${params}`, bearerToken);
  const user = response.data as XApiUser | undefined;

  if (!user?.id) throw new Error(`X user not found: ${username}`);

  return user;
}

function buildTweetParams({
  query,
  maxResults,
  excludeRetweets,
}: {
  query?: string;
  maxResults: number;
  excludeRetweets: boolean;
}) {
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "author_id,created_at,entities,lang,public_metrics,referenced_tweets,attachments",
    "user.fields": "description,profile_image_url,verified",
    "media.fields": "duration_ms,preview_image_url,type,url",
    expansions: "author_id,attachments.media_keys",
  });

  if (query) {
    params.set("query", query);
  } else if (excludeRetweets) {
    params.set("exclude", "retweets,replies");
  }

  return params;
}

async function fetchXJson(url: string, bearerToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "User-Agent": process.env.AIQ_USER_AGENT || "AIQ/1.0",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`X API ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json();
}

function normalizeTweetsResponse(
  response: {
    data?: XApiTweet[];
    includes?: {
      users?: XApiUser[];
      media?: XApiMedia[];
    };
  },
  {
    sourceType,
    fallbackUser,
  }: {
    sourceType: RawXPost["sourceType"];
    fallbackUser?: XApiUser;
  },
) {
  const users = new Map((response.includes?.users ?? []).map((user) => [user.id, user]));
  const media = new Map((response.includes?.media ?? []).map((item) => [item.media_key, item]));
  const fetchedAt = new Date().toISOString();

  return (response.data ?? [])
    .map((tweet): RawXPost | null => {
      const author = users.get(tweet.author_id ?? "") ?? fallbackUser;

      if (!author) return null;

      const username = author.username;
      const url = `https://x.com/${username}/status/${tweet.id}`;
      const metrics = tweet.public_metrics ?? {};
      const attachedMedia = (tweet.attachments?.media_keys ?? [])
        .map((key) => media.get(key))
        .filter(Boolean) as XApiMedia[];

      return {
        id: tweet.id,
        url,
        text: tweet.text,
        lang: tweet.lang ?? "und",
        createdAt: tweet.created_at ?? fetchedAt,
        author: {
          id: author.id,
          username,
          name: author.name,
          verified: author.verified,
          description: author.description,
          profileImageUrl: author.profile_image_url,
        },
        metrics: {
          likes: metrics.like_count ?? 0,
          reposts: metrics.retweet_count ?? 0,
          replies: metrics.reply_count ?? 0,
          quotes: metrics.quote_count ?? 0,
          views: metrics.impression_count,
          bookmarks: metrics.bookmark_count,
        },
        entities: {
          urls: tweet.entities?.urls?.map((item) => ({
            url: item.url,
            expandedUrl: item.expanded_url ?? item.url,
            displayUrl: item.display_url ?? item.expanded_url ?? item.url,
            title: item.title,
            description: item.description,
            images: item.images?.map((image) => image.url ?? "").filter(Boolean),
          })),
          hashtags: tweet.entities?.hashtags?.map((item) => item.tag ?? "").filter(Boolean),
          mentions: tweet.entities?.mentions?.map((item) => item.username ?? "").filter(Boolean),
        },
        media: attachedMedia.map((item) => ({
          type: item.type,
          url: item.url,
          previewImageUrl: item.preview_image_url,
          durationMs: item.duration_ms,
        })),
        referencedPosts: tweet.referenced_tweets?.map((item) => ({
          type: item.type,
          id: item.id,
        })),
        sourceType,
        fetchedAt,
      };
    })
    .filter(Boolean) as RawXPost[];
}

function evaluateRawPost(post: RawXPost) {
  const account = findWhitelistAccount(post.author.username);
  const authorityScore = account?.authorityScore ?? (post.sourceType === "keyword_search" ? 3 : 6);
  const normalizedText = normalizeText(post.text);
  const matchedIncludeSignals = includeSignals.filter((signal) =>
    normalizedText.includes(signal.toLowerCase()),
  );
  const matchedExcludeSignals = excludeKeywords.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase()),
  );
  const ageMs = Date.now() - new Date(post.createdAt).getTime();
  const ageDays = ageMs / 86_400_000;
  const freshnessBoost = ageMs <= 6 * 3_600_000 ? 30 : ageDays <= 1 ? 20 : ageDays <= 3 ? 10 : 0;
  const heatScore =
    post.metrics.likes +
    post.metrics.reposts * 4 +
    post.metrics.quotes * 5 +
    post.metrics.replies * 2 +
    (post.metrics.views ?? 0) * 0.01 +
    authorityScore * 20 +
    freshnessBoost;
  const riskScore = matchedExcludeSignals.length > 0 ? 8 : post.sourceType === "keyword_search" ? 4 : 2;
  const qualityScore = Math.min(
    10,
    Math.max(
      1,
      Math.round(authorityScore * 0.55 + matchedIncludeSignals.length * 0.9 + Math.min(heatScore / 200, 2)),
    ),
  );
  const category = inferCategory(post, matchedIncludeSignals, account);
  const hasUsefulLink = Boolean(post.entities?.urls?.some((url) => isUsefulExpandedUrl(url.expandedUrl)));
  const isRetweet = post.referencedPosts?.some((item) => item.type === "retweeted");
  let reason = "passed";
  let shouldPublish = true;

  if (isRetweet) {
    reason = "retweet";
    shouldPublish = false;
  } else if (ageDays > 7) {
    reason = "older-than-7-days";
    shouldPublish = false;
  } else if (matchedExcludeSignals.length > 0) {
    reason = "excluded-keyword";
    shouldPublish = false;
  } else if (matchedIncludeSignals.length === 0 && authorityScore < 9) {
    reason = "missing-include-signal";
    shouldPublish = false;
  } else if (post.sourceType === "keyword_search" && heatScore < 120 && !hasUsefulLink) {
    reason = "keyword-heat-too-low";
    shouldPublish = false;
  } else if (qualityScore < 5) {
    reason = "quality-too-low";
    shouldPublish = false;
  }

  return {
    shouldPublish,
    reason,
    category,
    authorType: account?.authorType ?? "creator",
    authorityScore,
    heatScore: Math.round(heatScore),
    qualityScore,
    riskScore,
    matchedIncludeSignals,
  };
}

function rawXPostToPost(
  post: RawXPost,
  decision: ReturnType<typeof evaluateRawPost>,
): Post {
  const account = findWhitelistAccount(post.author.username);
  const category = decision.category;
  const title = buildChineseTitle(post, category);
  const summary = buildChineseSummary(post);
  const whyItMatters = buildWhyImportant(post, decision);
  const link = post.entities?.urls?.find((item) => isUsefulExpandedUrl(item.expandedUrl));
  const imageUrls = uniqueStrings([
    ...(post.media ?? []).flatMap((item) => [item.url, item.previewImageUrl]).filter(Boolean) as string[],
    ...(post.entities?.urls ?? []).flatMap((item) => item.images ?? []),
  ]);
  const tags = uniqueStrings([
    "X",
    ...categoryTags(category),
    ...(account?.tags ?? []),
    ...(post.entities?.hashtags ?? []),
    ...decision.matchedIncludeSignals.slice(0, 3).map(formatSignalTag),
  ]).slice(0, 8);

  return {
    id: buildGeneratedPostId({
      sourceId: `x-${post.author.username.toLowerCase()}`,
      sourceUrl: post.url,
      title,
      type: category,
    }),
    sourceId: `x-${post.author.username.toLowerCase()}`,
    type: category,
    title,
    summary,
    content: `${summary}\n\n原文摘录：${cleanTweetText(post.text)}`,
    whyItMatters,
    editorComment: whyItMatters,
    sourceName: `X / ${post.author.name}`,
    sourceUrl: link?.expandedUrl || post.url,
    coverImageUrl: imageUrls[0],
    imageUrls,
    contentBlocks: [
      { type: "paragraph", text: summary },
      { type: "paragraph", text: `原文摘录：${cleanTweetText(post.text)}` },
      ...(imageUrls[0] ? [{ type: "image" as const, url: imageUrls[0], alt: title }] : []),
    ],
    author: post.author.name,
    profileUrl: `https://x.com/${post.author.username}`,
    tags,
    createdAt: post.createdAt,
    collectedAt: post.fetchedAt,
    likesCount: post.metrics.likes,
    commentsCount: post.metrics.replies + post.metrics.quotes,
    savesCount: post.metrics.bookmarks ?? post.metrics.reposts,
    featured: decision.heatScore >= 260 || decision.authorityScore >= 9,
  };
}

function addSourceDiagnostics(
  diagnostics: XIngestDiagnostics,
  account: XWhitelistAccount,
  posts: RawXPost[],
) {
  const sourceReasons: Record<string, number> = {};
  let passedCount = 0;

  for (const post of posts) {
    const decision = evaluateRawPost(post);
    if (decision.shouldPublish) passedCount += 1;
    else incrementReason(sourceReasons, decision.reason);
  }

  diagnostics.sourceDiagnostics.push({
    source: account.username,
    group: account.group,
    rawCount: posts.length,
    passedCount,
    rejectionReasonCounts: sourceReasons,
  });
}

function inferCategory(
  post: RawXPost,
  signals: string[],
  account?: XWhitelistAccount,
): PostType {
  const text = normalizeText(post.text);

  if (/(video|sora|runway|pika|drama|film|filmmaking|series|短剧|微短剧|ai影视|视频生成)/i.test(text)) {
    return "video";
  }
  if (text.includes("open source") || text.includes("open-source") || text.includes("github") || text.includes("开源")) {
    return "skill";
  }
  if (text.includes("api") || text.includes("tool") || text.includes("developer") || text.includes("coding") || text.includes("mcp") || text.includes("rag")) {
    return "tool";
  }
  if (text.includes("launch") || text.includes("introducing") || text.includes("released") || text.includes("product")) {
    return "product";
  }
  if (text.includes("paper") || text.includes("arxiv") || text.includes("benchmark") || text.includes("research")) {
    return "news";
  }
  if (account?.group === "researcher" || signals.includes("agent") || signals.includes("reasoning")) {
    return "opinion";
  }
  if (account?.group === "developer") {
    return "tool";
  }

  return account?.group === "official" ? "news" : "opinion";
}

function buildChineseTitle(post: RawXPost, category: PostType) {
  const text = cleanTweetText(post.text);
  const firstSentence = text.split(/[。.!?\n]/)[0]?.trim() || text;
  const compact = truncate(firstSentence, 42);
  const categoryLabel: Record<PostType, string> = {
    news: "新动态",
    opinion: "观点",
    tool: "工具更新",
    skill: "实践",
    product: "产品发布",
    case: "案例",
    video: "AI视频",
  };

  return `${post.author.name}：${compact || categoryLabel[category]}`;
}

function buildChineseSummary(post: RawXPost) {
  const text = cleanTweetText(post.text);
  const link = post.entities?.urls?.find((item) => isUsefulExpandedUrl(item.expandedUrl));
  const linkHint = link?.title ? ` 相关链接指向「${truncate(link.title, 28)}」。` : "";

  return `${post.author.name} 在 X 上发布了这条 AI 动态：${truncate(text, 92)}${linkHint}`;
}

function buildWhyImportant(
  post: RawXPost,
  decision: ReturnType<typeof evaluateRawPost>,
) {
  const authorLabel = authorTypeLabel(decision.authorType);
  const heat = formatNumber(decision.heatScore);

  if (decision.category === "opinion") {
    return `这条内容来自${authorLabel}，适合观察 AI 行业对模型能力、Agent 或产品方向的最新判断。综合权威度和互动信号后热度为 ${heat}。`;
  }

  if (decision.category === "tool" || decision.category === "skill") {
    return `它可能影响开发者的 AI 应用搭建、RAG、Agent 或模型部署流程，值得放入首页作为工具和实践信号。综合热度为 ${heat}。`;
  }

  if (decision.category === "video") {
    return `AI 视频和 AI 短剧正在同时改变创作工具、内容供给和海外短剧市场，这条动态来自高信号账号，适合作为视频模型、成片案例或市场变化的线索。`;
  }

  return `这条动态来自${authorLabel}，并命中发布、研究、模型或产品更新信号，适合作为首页 AI 情报流的高可信来源。`;
}

function categoryTags(type: PostType) {
  const map: Record<PostType, string[]> = {
    news: ["新闻"],
    opinion: ["观点"],
    tool: ["工具"],
    skill: ["开源"],
    product: ["产品"],
    case: ["案例"],
    video: ["AI视频", "AI短剧"],
  };

  return map[type];
}

function findWhitelistAccount(username: string) {
  return whitelistAccounts.find(
    (account) => account.username.toLowerCase() === username.toLowerCase(),
  );
}

function cleanTweetText(text: string) {
  return text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isUsefulExpandedUrl(url?: string) {
  if (!url) return false;
  return !/^(https?:\/\/)?(x|twitter)\.com\//i.test(url);
}

function incrementReason(counts: Record<string, number>, reason: string) {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatSignalTag(signal: string) {
  const normalized = signal.replace(/-/g, " ");
  if (normalized.toLowerCase() === "api") return "API";
  if (normalized.toLowerCase() === "llm") return "LLM";
  if (normalized.toLowerCase() === "rag") return "RAG";
  if (normalized.toLowerCase() === "mcp") return "MCP";

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function authorTypeLabel(type: XAuthorType) {
  const map: Record<XAuthorType, string> = {
    official: "官方机构",
    researcher: "研究者",
    founder: "创始人/行业大佬",
    developer: "开发者社区",
    media: "权威媒体",
    creator: "高质量创作者",
  };

  return map[type];
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatNumber(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
