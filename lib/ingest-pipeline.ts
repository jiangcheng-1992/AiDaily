import { autoIngestSources, type AiSource } from "@/lib/ai-sources";
import { generateProductionAiComments } from "@/lib/ai-comment-service";
import { fetchBackupVideoItems } from "@/lib/backup-video-fetcher";
import { fetchDouyinVideoItems, type DouyinVideoItem } from "@/lib/douyin-video-fetcher";
import { fetchXFeedPosts } from "@/lib/x-feed-fetcher";
import {
  fetchGithubRepoIssueComments,
  fetchHotGithubSkillRepos,
  type GitHubRepo,
} from "@/lib/github-skills";
import type { Comment, Post } from "@/lib/mock-data";
import { buildGeneratedPostId } from "@/lib/post-identity";
import { buildProductionPostCopy } from "@/lib/post-insights";
import { fetchSourceItems, type SourceItem } from "@/lib/source-fetcher";
import { ingestSubmittedSource } from "@/lib/submitted-source-ingest";
import { readSubmittedSources } from "@/lib/submitted-sources-store";

export type IngestRunResult = {
  fetchedAt: string;
  sourceCount: number;
  githubRepoCount: number;
  successCount: number;
  failureCount: number;
  primarySuccessCount: number;
  primaryFailureCount: number;
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
  video: {
    attempted: boolean;
    sourceCount: number;
    successCount: number;
    failureCount: number;
    postCount: number;
    posts: Post[];
    sources: Array<{
      sourceId: string;
      sourceName: string;
      ok: boolean;
      count: number;
      error?: string;
    }>;
  };
  x: {
    ok: boolean;
    configured: boolean;
    count: number;
    sourceCount: number;
    keywordQueryCount: number;
    error?: string;
    diagnostics?: unknown;
  };
};

export async function runIngestPipeline({
  sourceLimit = 12,
  itemLimit = 6,
  githubLimit = 8,
  douyinSourceLimit = 12,
  douyinItemLimit = 2,
  backupVideoSourceLimit = 6,
  backupVideoItemLimit = 2,
  submittedSourceLimit = 8,
  xSourceLimit = 24,
  xItemLimit = 3,
  xKeywordLimit = 0,
  xPublishLimit = 12,
  generateAiComments = true,
}: {
  sourceLimit?: number;
  itemLimit?: number;
  githubLimit?: number;
  douyinSourceLimit?: number;
  douyinItemLimit?: number;
  backupVideoSourceLimit?: number;
  backupVideoItemLimit?: number;
  submittedSourceLimit?: number;
  xSourceLimit?: number;
  xItemLimit?: number;
  xKeywordLimit?: number;
  xPublishLimit?: number;
  generateAiComments?: boolean;
}): Promise<IngestRunResult> {
  const sources = autoIngestSources.slice(0, sourceLimit);
  const fetchedSources = await fetchSourcesWithLimit(sources, itemLimit, 4);
  const sourcePosts = fetchedSources.flatMap((result) => result.posts);
  const submittedResult = await runSubmittedSourcesTask({
    sourceLimit: submittedSourceLimit,
    itemLimit: Math.min(itemLimit, 3),
  });
  const videoResult = await runVideoIngestTask({
    douyinSourceLimit,
    douyinItemLimit,
    backupVideoSourceLimit,
    backupVideoItemLimit,
  });
  const xResult = await fetchXFeedPosts({
    sourceLimit: xSourceLimit,
    itemLimit: xItemLimit,
    keywordLimit: xKeywordLimit,
    publishLimit: xPublishLimit,
  });
  const githubResult = await fetchGithubPosts(githubLimit);
  const githubAttempted = githubLimit > 0;
  const posts = [
    ...githubResult.posts,
    ...sourcePosts,
    ...submittedResult.posts,
    ...videoResult.posts,
    ...xResult.posts,
  ].sort(
    (a, b) => getPostPublishedSortTime(b) - getPostPublishedSortTime(a),
  );
  const submittedPostIds = new Set(submittedResult.posts.map((post) => post.id));
  const comments: Record<string, Comment[]> = {};
  const aiCommentResults = generateAiComments ? await mapWithConcurrency(
      posts.filter((post) => !submittedPostIds.has(post.id)),
    2,
    async (post) => {
      const result = await generateProductionAiComments({ post });
      if (result.error) {
        console.warn("[ingest] ai comment generation skipped", {
          postId: post.id,
          sourceName: post.sourceName,
          error: result.error,
        });
      }
      return [post.id, result.comments] as const;
    },
  ) : [];
  const primarySuccessCount =
    fetchedSources.filter((result) => result.ok).length +
    (githubAttempted && githubResult.ok ? 1 : 0);
  const primaryFailureCount =
    fetchedSources.filter((result) => !result.ok).length +
    (githubAttempted && !githubResult.ok ? 1 : 0);

  aiCommentResults.forEach(([postId, aiComments]) => {
    comments[postId] = [
      ...(githubResult.comments[postId] ?? []),
      ...(submittedResult.comments[postId] ?? []),
      ...aiComments,
    ];
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourceCount: sources.length,
    githubRepoCount: githubResult.posts.length,
    successCount: primarySuccessCount,
    failureCount: primaryFailureCount,
    primarySuccessCount,
    primaryFailureCount,
    posts,
    comments,
    sources: [
      ...fetchedSources.map(({ source, posts, ...result }) => {
        void posts;
        return {
          sourceId: source.id,
          sourceName: source.name,
          ...result,
        };
      }),
      ...submittedResult.sources,
    ],
    github: {
      ok: githubResult.ok,
      count: githubResult.posts.length,
      error: githubResult.error,
    },
    video: videoResult,
    x: {
      ok: xResult.ok,
      configured: xResult.diagnostics.configured,
      count: xResult.count,
      sourceCount: xResult.diagnostics.sourceCount,
      keywordQueryCount: xResult.diagnostics.keywordQueryCount,
      error: xResult.error,
      diagnostics: xResult.diagnostics,
    },
  };
}

async function runVideoIngestTask({
  douyinSourceLimit,
  douyinItemLimit,
  backupVideoSourceLimit,
  backupVideoItemLimit,
}: {
  douyinSourceLimit: number;
  douyinItemLimit: number;
  backupVideoSourceLimit: number;
  backupVideoItemLimit: number;
}): Promise<IngestRunResult["video"]> {
  const attempted = douyinSourceLimit > 0 || backupVideoSourceLimit > 0;

  if (!attempted) {
    return {
      attempted: false,
      sourceCount: 0,
      successCount: 0,
      failureCount: 0,
      postCount: 0,
      posts: [],
      sources: [],
    };
  }

  try {
    const [douyinResults, backupResults] = await Promise.all([
      douyinSourceLimit > 0
        ? fetchDouyinVideoItems({
            sourceLimit: douyinSourceLimit,
            itemLimit: douyinItemLimit,
          }).catch((error) => [
            {
              source: {
                id: "douyin",
                name: "抖音视频独立任务",
              },
              ok: false,
              count: 0,
              items: [],
              error: error instanceof Error ? error.message : "Unknown Douyin ingest error",
            },
          ])
        : Promise.resolve([]),
      backupVideoSourceLimit > 0
        ? fetchBackupVideoItems({
            sourceLimit: backupVideoSourceLimit,
            itemLimit: backupVideoItemLimit,
          })
        : Promise.resolve([]),
    ]);
    const videoSourceResults = [...douyinResults, ...backupResults];
    const posts = (
      await mapWithConcurrency(
        videoSourceResults.flatMap((result) => result.items),
        3,
        async (item) => douyinItemToPost(item),
      )
    ).filter(Boolean);
    const sources = videoSourceResults.map(({ source, items, ...result }) => {
      void items;
      return {
        sourceId: source.id,
        sourceName: source.name,
        ...result,
      };
    });
    const failureCount = sources.filter((result) => !result.ok).length;

    if (failureCount > 0) {
      console.warn("[ingest-video] video task completed with partial failures", {
        douyinSourceLimit,
        douyinItemLimit,
        backupVideoSourceLimit,
        backupVideoItemLimit,
        successCount: sources.filter((result) => result.ok).length,
        failureCount,
        postCount: posts.length,
      });
    }

    return {
      attempted,
      sourceCount: sources.length,
      successCount: sources.filter((result) => result.ok).length,
      failureCount,
      postCount: posts.length,
      posts,
      sources,
    };
  } catch (error) {
    console.warn("[ingest-video] video task failed independently", {
      douyinSourceLimit,
      douyinItemLimit,
      backupVideoSourceLimit,
      backupVideoItemLimit,
      error: error instanceof Error ? error.message : "Unknown video ingest error",
    });

    return {
      attempted,
      sourceCount: douyinSourceLimit + backupVideoSourceLimit,
      successCount: 0,
      failureCount: douyinSourceLimit + backupVideoSourceLimit,
      postCount: 0,
      posts: [],
      sources: [
        {
          sourceId: "douyin",
          sourceName: "抖音视频独立任务",
          ok: false,
          count: 0,
          error: error instanceof Error ? error.message : "Unknown video ingest error",
        },
      ],
    };
  }
}

async function runSubmittedSourcesTask({
  sourceLimit,
  itemLimit,
}: {
  sourceLimit: number;
  itemLimit: number;
}) {
  const store = await readSubmittedSources();
  const activeSources = store.sources
    .filter((source) => source.status === "active" || source.status === "error")
    .slice(0, sourceLimit);
  const results = await mapWithConcurrency(activeSources, 2, async (source) => {
    try {
      const result = await ingestSubmittedSource(source, itemLimit);
      return {
        sourceId: source.id,
        sourceName: source.name,
        ok: true,
        count: result.posts.length,
        posts: result.posts,
        comments: result.comments,
      };
    } catch (error) {
      console.warn("[ingest-submitted-source] custom source failed", {
        sourceId: source.id,
        sourceName: source.name,
        error: error instanceof Error ? error.message : "Unknown submitted source error",
      });
      return {
        sourceId: source.id,
        sourceName: source.name,
        ok: false,
        count: 0,
        posts: [],
        comments: {},
        error: error instanceof Error ? error.message : "Unknown submitted source error",
      };
    }
  });

  return {
    posts: results.flatMap((result) => result.posts),
    comments: results.reduce<Record<string, Comment[]>>((acc, result) => {
      Object.assign(acc, result.comments);
      return acc;
    }, {}),
    sources: results.map(({ posts, comments, ...result }) => {
      void posts;
      void comments;
      return result;
    }),
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
        const posts = await mapWithConcurrency(
          items,
          2,
          async (item) => sourceItemToPost(item, source),
        );
        results.push({
          source,
          ok: true,
          count: items.length,
          posts,
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
    const posts = await mapWithConcurrency(repos, 3, async (repo) => githubRepoToPost(repo));
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

async function sourceItemToPost(item: SourceItem, source: AiSource): Promise<Post> {
  const collectedAt = new Date().toISOString();
  const publishedAt = toIsoDate(item.publishedAt);
  const createdAt = publishedAt || collectedAt;
  const tags = uniqueTags([...item.tags, authorityLabel(source.authority)]).slice(0, 6);
  const imageCandidates = collectArticleImageCandidates(item);
  const coverImageUrl = await pickBestArticleCoverImage(imageCandidates, item.url);
  const imageUrls = imageCandidates.length ? imageCandidates : coverImageUrl ? [coverImageUrl] : undefined;
  const copy = await buildProductionPostCopy({
    title: item.title,
    rawContent: item.content || item.summary,
    fallbackSummary:
      item.summary || `来自 ${item.sourceName} 的最新 AI 动态，AI圈已纳入定时信息源。`,
    sourceName: item.sourceName,
    tags,
  });

  return {
    id: buildGeneratedPostId({
      sourceId: item.sourceId,
      sourceUrl: item.url,
      title: item.title,
      type: source.recommendedType,
    }),
    sourceId: item.sourceId,
    type: source.recommendedType,
    title: item.title,
    summary: copy.summary,
    content: copy.content,
    whyItMatters: copy.whyItMatters,
    editorComment: copy.editorComment,
    sourceName: item.sourceName,
    sourceUrl: item.url,
    coverImageUrl,
    imageUrls,
    contentBlocks: item.contentBlocks,
    tags,
    createdAt,
    collectedAt,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
  };
}

function collectArticleImageCandidates(item: SourceItem) {
  return uniqueStrings([
    item.coverImageUrl,
    ...(item.imageUrls ?? []),
    ...(item.contentBlocks
      ?.filter((block) => block.type === "image")
      .map((block) => block.url) ?? []),
  ]);
}

async function pickBestArticleCoverImage(candidates: string[], referrerUrl?: string) {
  if (candidates.length <= 1) return candidates[0];

  const scored = await Promise.all(
    candidates.slice(0, 8).map(async (url, index) => {
      const dimensions = await readRemoteImageDimensions(url, referrerUrl);
      return {
        url,
        score: scoreArticleCoverCandidate(dimensions, index),
      };
    }),
  );

  return scored.sort((left, right) => right.score - left.score)[0]?.url ?? candidates[0];
}

type ImageDimensions = {
  width: number;
  height: number;
};

function scoreArticleCoverCandidate(dimensions: ImageDimensions | null, index: number) {
  const orderScore = Math.max(0, 18 - index * 2);
  if (!dimensions) return orderScore;

  const ratio = dimensions.width / dimensions.height;
  let score = 40 + orderScore;

  if (ratio >= 1.18 && ratio <= 2.05) score += 44;
  else if (ratio >= 1.05 && ratio <= 2.2) score += 20;
  else if (ratio > 2.6) score -= 62;
  else if (ratio > 2.25) score -= 46;
  else if (ratio < 0.8) score -= 36;

  if (dimensions.height < 280) score -= 24;
  if (dimensions.width < 360) score -= 18;
  if (dimensions.width * dimensions.height > 180_000) score += 10;

  return score;
}

async function readRemoteImageDimensions(
  url: string,
  referrerUrl?: string,
): Promise<ImageDimensions | null> {
  try {
    const referrer = buildImageDimensionReferrer(url, referrerUrl);
    const response = await fetch(url, {
      headers: {
        "user-agent":
          process.env.AIQ_USER_AGENT ??
          "AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
        range: "bytes=0-65535",
        ...(referrer ? { referer: referrer } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok && response.status !== 206) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return readImageDimensions(buffer);
  } catch {
    return null;
  }
}

function buildImageDimensionReferrer(imageUrl: string, referrerUrl?: string) {
  if (referrerUrl) return referrerUrl;

  try {
    const url = new URL(imageUrl);
    if (/qbitai\.com$/i.test(url.hostname)) return "https://www.qbitai.com/";
    return url.origin;
  } catch {
    return undefined;
  }
}

function readImageDimensions(buffer: Buffer): ImageDimensions | null {
  return readPngDimensions(buffer) || readJpegDimensions(buffer) || readWebpDimensions(buffer);
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

async function douyinItemToPost(item: DouyinVideoItem): Promise<Post> {
  const collectedAt = new Date().toISOString();
  const createdAt = item.publishedAt || collectedAt;
  const tags = uniqueTags(item.tags).slice(0, 8);
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

async function githubRepoToPost(repo: GitHubRepo): Promise<Post> {
  const topics = repo.topics ?? [];
  const skillUsage = describeGithubSkillUsage(repo);
  const selectionLabel = repo.selectionLabel ?? "爆款热门";
  const selectionReason =
    repo.selectionReason ??
    "该仓库近期保持活跃更新，并已得到 GitHub 开发者的真实使用验证。";
  const tags = uniqueTags([
    "GitHub",
    "AI Skill",
    ...selectionLabel.split(" + "),
    repo.language || "",
    ...topics.slice(0, 5),
  ]).slice(0, 8);
  const description = repo.description || "暂无仓库简介";
  const githubUrl = repo.html_url;
  const content =
    `GitHub 链接：${githubUrl}\n\n` +
    `入选原因：${selectionReason}\n\n` +
    `适用场景：${skillUsage.scenarios}\n\n` +
    `怎么用：${skillUsage.howToUse}\n\n` +
    `更适合谁：${skillUsage.bestFor}\n\n` +
    `这个 Skill 能解决的问题：${skillUsage.useCase}\n\n` +
    `仓库简介：${description}。\n\n` +
    `真实 GitHub 指标：${repo.stargazers_count.toLocaleString("zh-CN")} stars、${repo.forks_count.toLocaleString("zh-CN")} forks、${repo.open_issues_count.toLocaleString("zh-CN")} open issues。主要语言：${repo.language || "未标注"}。创建时间：${new Date(repo.created_at).toLocaleDateString("zh-CN")}。最近推送：${new Date(repo.pushed_at).toLocaleString("zh-CN")}。\n\n` +
    "AI圈会持续抓取 GitHub 爆款热门和近期增速快的 Skill，并抓取热门 issue 标题作为真实讨论线索。";
  const copy = await buildProductionPostCopy({
    title: `GitHub ${selectionLabel} AI Skill：${repo.full_name}`,
    rawContent: content,
    fallbackSummary: `${description}。适用场景：${skillUsage.scenarios}。怎么用：${skillUsage.howToUse}`,
    sourceName: "GitHub Repo",
    tags,
  });

  return {
    id: `github-${repo.id}`,
    type: "skill",
    title: `GitHub ${selectionLabel} AI Skill：${repo.full_name}`,
    summary: copy.summary,
    content: copy.content,
    whyItMatters: copy.whyItMatters,
    editorComment: copy.editorComment,
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

function describeGithubSkillUsage(repo: GitHubRepo) {
  const text = [
    repo.full_name,
    repo.description ?? "",
    repo.language ?? "",
    ...(repo.topics ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("workflow") || text.includes("automation") || text.includes("n8n")) {
    return {
      useCase: "把 AI 节点、数据库、表单、邮件和外部 API 串成自动化工作流",
      scenarios: "客服分发、线索跟进、内容发布、表单处理和内部审批自动化",
      howToUse:
        "先挑一个高频重复流程做试点，再接入触发器、HTTP/数据库节点和 LLM 节点，最后补人工审核与失败重试。",
      bestFor: "运营、销售、客服和内部流程自动化团队",
    };
  }

  if (text.includes("agent")) {
    return {
      useCase: "搭建 AI Agent、自动化任务执行和多步骤工作流",
      scenarios: "研究助手、企业 Copilot、任务分解执行和跨系统操作代理",
      howToUse:
        "从一个明确输入输出的任务开始，先定义工具调用边界，再补日志、权限控制和人工兜底。",
      bestFor: "想做企业助手、Agent 工作流或自动执行链路的开发者",
    };
  }

  if (text.includes("rag") || text.includes("retrieval") || text.includes("vector")) {
    return {
      useCase: "构建知识库问答、文档检索和带引用的 AI 搜索",
      scenarios: "企业知识库、客服问答、文档助手和垂直搜索",
      howToUse:
        "先准备高质量文档切片和权限范围，再接入检索、重排和引用展示，最后补召回评测。",
      bestFor: "做企业知识库、客服机器人和文档问答产品的团队",
    };
  }

  if (text.includes("mcp") || text.includes("model-context-protocol")) {
    return {
      useCase: "把外部工具、数据源和本地能力接入大模型上下文",
      scenarios: "让 AI 调数据库、连本地文件、调用浏览器和企业内部系统",
      howToUse:
        "先接最常用的 1 到 2 个工具能力，再定义权限、入参与错误返回格式，最后接到现有聊天或 Agent 界面。",
      bestFor: "在做 AI 编程、Agent 平台或企业内部助手的人",
    };
  }

  if (text.includes("prompt")) {
    return {
      useCase: "沉淀提示词模板、评测提示效果和复用提示工程流程",
      scenarios: "内容生产、AI 编程规范、客服回复模板和多角色 Prompt 管理",
      howToUse:
        "先把高频任务拆成模板，再加版本管理、A/B 评测和失败样本复盘，避免 Prompt 只停在个人经验。",
      bestFor: "做内容团队、AI 产品和提示词资产沉淀的团队",
    };
  }

  if (text.includes("llm") || text.includes("chatbot") || text.includes("chatgpt")) {
    return {
      useCase: "开发 LLM 应用、聊天机器人和模型调用工程能力",
      scenarios: "AI 问答、Copilot、对话机器人和多模型调用网关",
      howToUse:
        "从一个窄场景对话入口开始，先跑通上下文、模型切换和日志监控，再逐步补权限和成本控制。",
      bestFor: "需要快速搭建 AI 应用原型和对话产品的开发者",
    };
  }

  return {
    useCase: "学习和复用 AI 应用工程实践，快速验证可落地的工具能力",
    scenarios: "内部工具增强、团队提效和 AI 功能试点验证",
    howToUse:
      "先选一个最痛的重复动作做小范围上线，再根据实际反馈决定是否继续扩功能或接更多系统。",
    bestFor: "想把 AI 能力尽快接进现有业务流程的产品和工程团队",
  };
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

function uniqueStrings(values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function getPostPublishedSortTime(post: Post) {
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

  // Douyin fallback pages often do not expose publish time; those items used
  // collection time as createdAt, which should not outrank truly fresh content.
  return Math.abs(createdAt - collectedAt) < 2 * 60 * 1000;
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
