import type { Post } from "@/lib/mock-data";

const authoritySourceKeywords = [
  "openai",
  "google",
  "deepmind",
  "anthropic",
  "github",
  "量子位",
  "机器之心",
  "36氪",
  "新智元",
  "极客公园",
  "官方",
];

const professionalKeywords = [
  "论文",
  "研究",
  "模型",
  "benchmark",
  "评测",
  "开源",
  "agent",
  "智能体",
  "api",
  "算法",
  "机器人",
  "多模态",
  "推理",
  "训练",
  "部署",
];

const hotKeywords = [
  "发布",
  "上线",
  "推出",
  "融资",
  "爆火",
  "首款",
  "全球",
  "openai",
  "gemini",
  "claude",
  "deepseek",
  "cursor",
  "codex",
];

export function calculatePostScore(post: Post) {
  const text = `${post.title} ${post.summary} ${post.whyItMatters} ${post.tags.join(" ")} ${
    post.sourceName
  } ${post.author ?? ""}`.toLowerCase();
  const professionalScore = scoreKeywordMatches(text, professionalKeywords, 2.2);
  const hotScore = scoreKeywordMatches(text, hotKeywords, 1.8) + scoreRecency(post);
  const creatorScore = scoreKeywordMatches(text, authoritySourceKeywords, 2.3);
  const engagementScore = Math.min(
    1.2,
    Math.log10(Math.max(0, post.likesCount) + Math.max(0, post.commentsCount) + 1) * 0.45,
  );
  const typeBonus = post.type === "skill" || post.type === "video" ? 0.25 : 0;
  const featuredBonus = post.featured ? 0.35 : 0;
  const rawScore =
    6.2 +
    professionalScore +
    hotScore +
    creatorScore +
    engagementScore +
    typeBonus +
    featuredBonus;

  return Math.max(6.8, Math.min(9.8, Number(rawScore.toFixed(1))));
}

function scoreKeywordMatches(text: string, keywords: string[], maxScore: number) {
  const matchCount = keywords.reduce(
    (count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );

  return Math.min(maxScore, matchCount * 0.38);
}

function scoreRecency(post: Post) {
  const date = new Date(post.collectedAt ?? post.createdAt);
  if (Number.isNaN(date.getTime())) return 0;

  const ageHours = (Date.now() - date.getTime()) / (60 * 60 * 1000);
  if (ageHours <= 6) return 0.9;
  if (ageHours <= 24) return 0.6;
  if (ageHours <= 72) return 0.3;
  return 0;
}
