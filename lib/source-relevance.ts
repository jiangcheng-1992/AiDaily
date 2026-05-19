import type { AiSource } from "@/lib/ai-sources";

type RelevanceInput = {
  title: string;
  summary?: string;
  content?: string;
  tags?: string[];
  url?: string;
};

const STRONG_AI_KEYWORDS = [
  "人工智能",
  "ai",
  "大模型",
  "模型",
  "多模态",
  "智能体",
  "agent",
  "生成式",
  "aigc",
  "视频生成",
  "ai视频",
  "ai动漫",
  "漫剧",
  "机器人",
  "具身",
  "openai",
  "anthropic",
  "claude",
  "chatgpt",
  "gpt",
  "gemini",
  "deepmind",
  "llm",
  "copilot",
  "sora",
  "veo",
  "imagen",
  "rag",
  "mcp",
  "prompt",
  "推理模型",
  "编程模型",
  "ai编程",
  "机器学习",
];

const TITLE_AI_ANCHOR_KEYWORDS = [
  "人工智能",
  "ai",
  "大模型",
  "智能体",
  "agent",
  "生成式",
  "aigc",
  "openai",
  "anthropic",
  "claude",
  "chatgpt",
  "gpt",
  "gemini",
  "deepmind",
  "llm",
  "copilot",
  "sora",
  "veo",
  "imagen",
  "多模态",
  "视频生成",
  "机器人",
  "具身",
  "模型",
];

const WEAK_INFRA_KEYWORDS = [
  "算力",
  "gpu",
  "服务器",
  "芯片",
  "云服务",
  "数据中心",
  "推理成本",
  "训练成本",
  "基础设施",
];

const BUSINESS_NOISE_PATTERNS = [
  /股票|股价|股权|控股子公司|注册资本|投资设立|公司拟|公告|董事会|证券代码/i,
  /收盘价格|涨幅|偏离值|异常波动|市值|持股|出资|资本市场/i,
  /市场开拓|客户资源|渠道生态|合作方|合资公司|主营业务/i,
];

const EXPLICIT_AI_ENTITY_KEYWORDS = [
  "openai",
  "anthropic",
  "claude",
  "chatgpt",
  "gpt",
  "gemini",
  "deepmind",
  "meta ai",
  "copilot",
  "llama",
  "agent",
  "智能体",
  "大模型",
  "多模态",
  "机器人",
  "具身",
  "视频生成",
  "ai编程",
  "生成式",
];

export function isRelevantAiContent(source: AiSource, input: RelevanceInput) {
  if (source.authority !== "media") {
    return true;
  }

  const title = normalize(input.title);
  const body = normalize(
    [input.title, input.summary, input.content, input.tags?.join(" "), input.url]
      .filter(Boolean)
      .join(" "),
  );

  const strongTitleHits = countKeywordHits(title, STRONG_AI_KEYWORDS);
  const strongBodyHits = countKeywordHits(body, STRONG_AI_KEYWORDS);
  const weakBodyHits = countKeywordHits(body, WEAK_INFRA_KEYWORDS);
  const hasTitleAiAnchor = containsAny(title, TITLE_AI_ANCHOR_KEYWORDS);
  const hasExplicitAiEntity = containsAny(body, EXPLICIT_AI_ENTITY_KEYWORDS);
  const hasBusinessNoise = BUSINESS_NOISE_PATTERNS.some((pattern) => pattern.test(body));

  if (!hasTitleAiAnchor && !hasExplicitAiEntity && hasBusinessNoise) {
    return false;
  }

  if (!hasTitleAiAnchor && !hasExplicitAiEntity && weakBodyHits > 0) {
    return false;
  }

  if (strongTitleHits >= 1) {
    return true;
  }

  if (hasExplicitAiEntity && strongBodyHits >= 1) {
    return true;
  }

  if (strongBodyHits >= 2 && !hasBusinessNoise) {
    return true;
  }

  if (weakBodyHits > 0 && strongBodyHits === 0) {
    return false;
  }

  if (hasBusinessNoise && strongBodyHits < 2 && !hasExplicitAiEntity) {
    return false;
  }

  return strongBodyHits >= 1 && !hasBusinessNoise;
}

function normalize(value?: string) {
  return (value ?? "").toLowerCase().trim();
}

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => buildKeywordRegex(keyword).test(value));
}

function countKeywordHits(value: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => {
    return count + (buildKeywordRegex(keyword).test(value) ? 1 : 0);
  }, 0);
}

function buildKeywordRegex(keyword: string) {
  const escaped = escapeRegExp(keyword.toLowerCase());

  if (/^[a-z0-9 .+-]+$/i.test(keyword)) {
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  }

  return new RegExp(escaped, "i");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
