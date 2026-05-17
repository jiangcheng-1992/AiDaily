import { createHash } from "node:crypto";

import { fetchableSources, type AiSource } from "@/lib/ai-sources";
import { generateAiCommentsForPost } from "@/lib/ai-comment-roles";
import {
  fetchGithubRepoIssueComments,
  fetchHotGithubSkillRepos,
  type GitHubRepo,
} from "@/lib/github-skills";
import type { Comment, Post } from "@/lib/mock-data";
import { fetchSourceItems, type SourceItem } from "@/lib/source-fetcher";

export type IngestRunResult = {
  fetchedAt: string;
  sourceCount: number;
  githubRepoCount: number;
  successCount: number;
  failureCount: number;
  posts: Post[];
  comments: Record<string, Comment[]>;
  sources: Array<{
    sourceId: string;
    sourceName: string;
    ok: boolean;
    count: number;
    error?: string;
  }>;
  github: {
    ok: boolean;
    count: number;
    error?: string;
  };
};

export async function runIngestPipeline({
  sourceLimit = 12,
  itemLimit = 6,
  githubLimit = 8,
}: {
  sourceLimit?: number;
  itemLimit?: number;
  githubLimit?: number;
}): Promise<IngestRunResult> {
  const sources = fetchableSources.slice(0, sourceLimit);
  const fetchedSources = await fetchSourcesWithLimit(sources, itemLimit, 4);
  const sourcePosts = fetchedSources.flatMap((result) => result.posts);
  const githubResult = await fetchGithubPosts(githubLimit);
  const githubAttempted = githubLimit > 0;
  const posts = [...githubResult.posts, ...sourcePosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const comments: Record<string, Comment[]> = {};

  for (const post of posts) {
    comments[post.id] = [
      ...(githubResult.comments[post.id] ?? []),
      ...generateAiCommentsForPost(post),
    ];
  }

  return {
    fetchedAt: new Date().toISOString(),
    sourceCount: sources.length,
    githubRepoCount: githubResult.posts.length,
    successCount:
      fetchedSources.filter((result) => result.ok).length +
      (githubAttempted && githubResult.ok ? 1 : 0),
    failureCount:
      fetchedSources.filter((result) => !result.ok).length +
      (githubAttempted && !githubResult.ok ? 1 : 0),
    posts,
    comments,
    sources: fetchedSources.map(({ source, posts, ...result }) => {
      void posts;
      return {
        sourceId: source.id,
        sourceName: source.name,
        ...result,
      };
    }),
    github: {
      ok: githubResult.ok,
      count: githubResult.posts.length,
      error: githubResult.error,
    },
  };
}

async function fetchSourcesWithLimit(
  sources: AiSource[],
  itemLimit: number,
  concurrency: number,
) {
  const results: Array<{
    source: AiSource;
    ok: boolean;
    count: number;
    posts: Post[];
    error?: string;
  }> = [];
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor];
      cursor += 1;

      try {
        const items = await fetchSourceItems(source, itemLimit);
        results.push({
          source,
          ok: true,
          count: items.length,
          posts: items.map((item) => sourceItemToPost(item, source)),
        });
      } catch (error) {
        results.push({
          source,
          ok: false,
          count: 0,
          posts: [],
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sources.length) }, () => worker()),
  );

  return results.sort((a, b) => a.source.name.localeCompare(b.source.name));
}

async function fetchGithubPosts(limit: number): Promise<{
  ok: boolean;
  posts: Post[];
  comments: Record<string, Comment[]>;
  error?: string;
}> {
  try {
    const repos = await fetchHotGithubSkillRepos(limit);
    const comments: Record<string, Comment[]> = {};
    const posts = repos.map(githubRepoToPost);
    const commentResults = await Promise.allSettled(
      repos.map((repo) => fetchGithubRepoIssueComments(repo, 2)),
    );

    commentResults.forEach((result, index) => {
      const postId = `github-${repos[index].id}`;
      comments[postId] = result.status === "fulfilled" ? result.value : [];
    });

    return { ok: true, posts, comments };
  } catch (error) {
    return {
      ok: false,
      posts: [],
      comments: {},
      error: error instanceof Error ? error.message : "Unknown GitHub error",
    };
  }
}

function sourceItemToPost(item: SourceItem, source: AiSource): Post {
  const collectedAt = new Date().toISOString();
  const publishedAt = toIsoDate(item.publishedAt);
  const createdAt = publishedAt || collectedAt;
  const summary =
    item.summary ||
    `来自 ${item.sourceName} 的最新 AI 动态，AI圈已纳入定时信息源。`;

  return {
    id: `source-${item.sourceId}-${hashText(item.url || item.title)}`,
    type: source.recommendedType,
    title: item.title,
    summary,
    content: `${summary}\n\n原始来源：${item.sourceName}\n原文时间：${publishedAt ? new Date(publishedAt).toLocaleString("zh-CN") : "未提供"}\n抓取时间：${new Date(collectedAt).toLocaleString("zh-CN")}\n\n说明：该内容来自 AI圈离线抓取任务。RSS/Atom 源通常不提供点赞和评论数据，因此互动数不会被编造；详情页会附带 AI 角色评论作为社区视角补充。`,
    whyItMatters:
      "这是来自权威 AI 信息源的最新变化，适合用于判断模型、产品、开发工具和创作者机会的方向。",
    editorComment:
      "AI圈抓取机器人已收录这条动态。建议点开原文核对细节，再结合 AI 评论里的产品、技术和风险视角判断是否值得跟进。",
    sourceName: item.sourceName,
    sourceUrl: item.url,
    tags: uniqueTags([...item.tags, authorityLabel(source.authority)]).slice(0, 6),
    createdAt,
    collectedAt,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
  };
}

function githubRepoToPost(repo: GitHubRepo): Post {
  const topics = repo.topics ?? [];
  const tags = uniqueTags([
    "GitHub",
    "AI Skill",
    repo.language || "",
    ...topics.slice(0, 5),
  ]).slice(0, 8);
  const useCase = describeGithubSkillUse(repo);
  const description = repo.description || "暂无仓库简介";
  const githubUrl = repo.html_url;

  return {
    id: `github-${repo.id}`,
    type: "skill",
    title: `GitHub 热门 AI Skill：${repo.full_name}`,
    summary: `${description}。用途：${useCase}`,
    content: `GitHub 链接：${githubUrl}\n\n这个 Skill 能用来：${useCase}\n\n仓库简介：${description}。\n\n真实 GitHub 指标：${repo.stargazers_count.toLocaleString("zh-CN")} stars、${repo.forks_count.toLocaleString("zh-CN")} forks、${repo.open_issues_count.toLocaleString("zh-CN")} open issues。主要语言：${repo.language || "未标注"}。最近推送：${new Date(repo.pushed_at).toLocaleString("zh-CN")}。\n\nAI圈会把 GitHub stars 作为点赞基数、forks 作为收藏基数，并抓取热门 issue 标题作为真实讨论线索。`,
    whyItMatters:
      `这个仓库可用于${useCase}。GitHub 的 stars、forks 和 issue 活跃度是开发者真实投票，高热度 AI Skill 往往意味着可复用工作流、开发范式或垂直工具机会正在形成。`,
    editorComment:
      "看这类仓库不要只看 stars，还要看最近提交、issues 是否活跃、README 是否能快速复现。能被复用到你当前项目里的，才是真正有价值的 skill。",
    sourceName: "GitHub Repo",
    sourceUrl: githubUrl,
    author: repo.owner.login,
    tags,
    createdAt:
      toIsoDate(repo.pushed_at) ||
      toIsoDate(repo.updated_at) ||
      new Date().toISOString(),
    likesCount: repo.stargazers_count,
    commentsCount: 0,
    savesCount: repo.forks_count,
    featured: repo.stargazers_count >= 10000,
  };
}

function describeGithubSkillUse(repo: GitHubRepo) {
  const text = [
    repo.full_name,
    repo.description ?? "",
    repo.language ?? "",
    ...(repo.topics ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("agent")) {
    return "搭建 AI Agent、自动化任务执行和多步骤工作流";
  }

  if (text.includes("rag") || text.includes("retrieval") || text.includes("vector")) {
    return "构建知识库问答、文档检索和带引用的 AI 搜索";
  }

  if (text.includes("mcp") || text.includes("model-context-protocol")) {
    return "把外部工具、数据源和本地能力接入大模型上下文";
  }

  if (text.includes("prompt")) {
    return "沉淀提示词模板、评测提示效果和复用提示工程流程";
  }

  if (text.includes("llm") || text.includes("chatbot") || text.includes("chatgpt")) {
    return "开发 LLM 应用、聊天机器人和模型调用工程能力";
  }

  if (text.includes("workflow") || text.includes("automation")) {
    return "编排自动化工作流，减少重复操作并连接多个工具";
  }

  return "学习和复用 AI 应用工程实践，快速验证可落地的工具能力";
}

function authorityLabel(authority: AiSource["authority"]) {
  const labels: Record<AiSource["authority"], string> = {
    official: "官方源",
    research: "研究源",
    media: "媒体源",
    community: "社区源",
    product: "产品源",
  };

  return labels[authority];
}

function toIsoDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function uniqueTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

function hashText(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}
