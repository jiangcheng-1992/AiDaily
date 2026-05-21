import { generateProductionAiComments } from "@/lib/ai-comment-service";
import { AI_COMMENT_GENERATION_VERSION } from "@/lib/ai-comment-roles";
import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
import { validateIngestRequest } from "@/lib/ingest-request-auth";
import type { GeneratedFeed } from "@/lib/generated-feed-store";
import type { Comment } from "@/lib/mock-data";
import { runIngestPipeline } from "@/lib/ingest-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleIngestRequest(request);
}

export async function POST(request: Request) {
  return handleIngestRequest(request);
}

async function handleIngestRequest(request: Request) {
  const authError = validateIngestRequest(request);

  if (authError) return authError;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const refreshAiComments = url.searchParams.get("refreshAiComments") === "1";
  const sourceLimit = readNonNegativeInt(
    url.searchParams.get("sourceLimit") ?? process.env.SOURCE_FETCH_LIMIT,
    12,
  );
  const itemLimit = readPositiveInt(
    url.searchParams.get("itemLimit") ?? process.env.SOURCE_ITEMS_PER_SOURCE,
    6,
  );
  const githubLimit = readNonNegativeInt(
    url.searchParams.get("githubLimit") ?? process.env.GITHUB_SKILL_LIMIT,
    8,
  );
  const douyinSourceLimit = readNonNegativeInt(
    url.searchParams.get("douyinSourceLimit") ?? process.env.DOUYIN_SOURCE_LIMIT,
    6,
  );
  const douyinItemLimit = readPositiveInt(
    url.searchParams.get("douyinItemLimit") ?? process.env.DOUYIN_ITEMS_PER_SOURCE,
    2,
  );
  const run = await runIngestPipeline({
    sourceLimit,
    itemLimit,
    githubLimit,
    douyinSourceLimit,
    douyinItemLimit,
  });
  const current = await readGeneratedFeed({ includeSkills: true });
  const mergedFeed = mergeGeneratedFeed({
    current,
    incomingPosts: run.posts,
    incomingComments: run.comments,
    limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
  });
  const nextFeed =
    refreshAiComments || hasOutdatedAiComments(mergedFeed)
      ? await rebuildFeedAiComments(mergedFeed, { force: refreshAiComments })
      : mergedFeed;

  if (!dryRun) {
    await writeGeneratedFeed(nextFeed);
  }
  const attemptedCount =
    sourceLimit + douyinSourceLimit + (githubLimit > 0 ? 1 : 0);
  const ingestOk = attemptedCount === 0 || run.successCount > 0 || run.posts.length > 0;

  return Response.json(
    {
      ok: ingestOk,
      dryRun,
      persisted: !dryRun,
      refreshAiComments,
      fetchedAt: run.fetchedAt,
      sourceCount: run.sourceCount,
      githubRepoCount: run.githubRepoCount,
      newPostCount: run.posts.length,
      totalPostCount: nextFeed.posts.length,
      successCount: run.successCount,
      failureCount: run.failureCount,
      message:
        "已完成 AI 文章源、抖音 AI 作者视频和 GitHub 热门 Skill 抓取，并为每条动态生成 AI 角色评论。GitHub 与抖音动态使用真实公开互动指标；不提供互动指标的 RSS 源不会编造点赞数。",
      sources: run.sources,
      github: run.github,
    },
    {
      status: ingestOk ? 200 : 502,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function rebuildFeedAiComments(
  feed: GeneratedFeed,
  options: { force?: boolean } = {},
): Promise<GeneratedFeed> {
  const comments: Record<string, Comment[]> = {};

  for (const post of feed.posts) {
    const currentComments = feed.comments[post.id] ?? [];
    const preservedComments = currentComments.filter((comment) => !comment.isAi);
    const currentAiComments = currentComments.filter((comment) => comment.isAi);

    if (!options.force && !shouldRefreshAiComments(currentAiComments)) {
      comments[post.id] = [...preservedComments, ...currentAiComments];
      continue;
    }

    const generated = await generateProductionAiComments({ post });
    comments[post.id] = [...preservedComments, ...generated.comments];
  }

  return {
    ...feed,
    comments,
  };
}

function hasOutdatedAiComments(feed: GeneratedFeed) {
  return feed.posts.some((post) => shouldRefreshAiComments(feed.comments[post.id] ?? []));
}

function shouldRefreshAiComments(comments: Comment[]) {
  const aiComments = comments.filter((comment) => comment.isAi);
  if (!aiComments.length) return true;

  return aiComments.some(
    (comment) => comment.generationVersion !== AI_COMMENT_GENERATION_VERSION,
  );
}

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
