import type { Post } from "@/lib/mock-data";
import type { WorkItem } from "@/lib/interesting-works";

export function buildInterestingSkillWorks(posts: Post[]): WorkItem[] {
  return dedupePosts(posts)
    .filter((post) => post.type === "skill")
    .sort(
      (a, b) =>
        b.likesCount + b.savesCount * 1.4 + b.commentsCount * 2 -
          (a.likesCount + a.savesCount * 1.4 + a.commentsCount * 2) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map(skillPostToWork);
}

function skillPostToWork(post: Post): WorkItem {
  const githubUrl = isGithubSkill(post) ? post.sourceUrl : undefined;
  const coverUrl = post.coverImageUrl || buildSkillCoverUrl(post);
  const useCase = extractSection(post.content, "这个 Skill 能解决的问题：") || post.summary;
  const scenarios = extractSection(post.content, "适用场景：");
  const howToUse = extractSection(post.content, "怎么用：");
  const bestFor = extractSection(post.content, "更适合谁：");

  return {
    id: `skill-${post.id}`,
    title: cleanupSkillTitle(post.title),
    description: buildSkillDescription(useCase, scenarios),
    whyInteresting: buildSkillDetail(useCase, scenarios, howToUse, bestFor, post),
    type: githubUrl ? "github" : "workflow",
    source: githubUrl ? "github" : "manual",
    coverUrl,
    externalUrl: `/post/${post.id}`,
    githubUrl,
    authorName: post.author || post.sourceName,
    toolNames: githubUrl
      ? ["GitHub", "AI Skill", ...(post.tags ?? []).slice(0, 2)]
      : ["AI Skill", ...(post.tags ?? []).slice(0, 2)],
    tags: Array.from(new Set(["Skill", ...post.tags])).slice(0, 6),
    status: "approved",
    featured: Boolean(post.featured),
    sourceVerified: true,
    viewCount: Math.max(post.likesCount * 8, post.savesCount * 18, 900),
    likeCount: post.likesCount,
    favoriteCount: post.savesCount,
    commentCount: post.commentsCount,
    clickCount: Math.max(post.likesCount + post.savesCount * 2, 120),
    heatScore: Math.min(
      99,
      Math.max(76, Math.round(Math.log10(post.likesCount + post.savesCount * 4 + 10) * 32)),
    ),
    createdAt: post.createdAt,
    publishedAt: post.collectedAt || post.createdAt,
    categoryHint: "skill",
  };
}

function buildSkillDescription(useCase: string, scenarios?: string) {
  const main = clipText(normalizeText(useCase), 64);
  if (!scenarios) return main;
  return clipText(`${main}。适合：${normalizeText(scenarios)}`, 110);
}

function buildSkillDetail(
  useCase: string,
  scenarios: string | undefined,
  howToUse: string | undefined,
  bestFor: string | undefined,
  post: Post,
) {
  const parts = [
    `这个 Skill 主要用来：${normalizeText(useCase)}`,
    scenarios ? `适用场景：${normalizeText(scenarios)}` : "",
    howToUse ? `上手方式：${normalizeText(howToUse)}` : "",
    bestFor ? `更适合：${normalizeText(bestFor)}` : "",
    !scenarios && !howToUse && !bestFor ? `补充判断：${normalizeText(post.whyItMatters)}` : "",
  ].filter(Boolean);

  return clipText(parts.join("。"), 240);
}

function cleanupSkillTitle(title: string) {
  return title
    .replace(/^GitHub\s+爆款热门\s+\+\s+增速快\s+AI Skill：/i, "")
    .replace(/^GitHub\s+爆款热门\s+AI Skill：/i, "")
    .replace(/^GitHub\s+增速快\s+AI Skill：/i, "")
    .replace(/^GitHub\s+AI Skill：/i, "")
    .trim();
}

function isGithubSkill(post: Post) {
  return Boolean(
    post.sourceUrl?.includes("github.com/") ||
      post.sourceName.toLowerCase().includes("github") ||
      post.id.startsWith("github-"),
  );
}

function extractSection(content: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`${escaped}([\\s\\S]*?)(?:\\n\\n|$)`));
  return match?.[1]?.trim();
}

function buildSkillCoverUrl(post: Post) {
  if (isGithubSkill(post) && post.sourceUrl) {
    const repoPath = post.sourceUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    if (repoPath && repoPath.includes("/")) {
      return `https://opengraph.githubassets.com/1/${repoPath}`;
    }
  }

  const prompt = encodeURIComponent(
    `modern AI skill card, productized workflow dashboard, code assistant interface, clean dark UI, feature focused, ${cleanupSkillTitle(post.title)}`,
  );
  return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${prompt}&image_size=landscape_16_9`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, maxLength: number) {
  const normalized = normalizeText(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function dedupePosts(posts: Post[]) {
  const map = new Map<string, Post>();
  for (const post of posts) {
    if (!map.has(post.id)) map.set(post.id, post);
  }
  return Array.from(map.values());
}
