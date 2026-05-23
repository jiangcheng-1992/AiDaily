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
    12,
  );
  const douyinItemLimit = readPositiveInt(
    url.searchParams.get("douyinItemLimit") ?? process.env.DOUYIN_ITEMS_PER_SOURCE,
    2,
  );
  const backupVideoSourceLimit = readNonNegativeInt(
    url.searchParams.get("backupVideoSourceLimit") ?? process.env.BACKUP_VIDEO_SOURCE_LIMIT,
    6,
  );
  const backupVideoItemLimit = readPositiveInt(
    url.searchParams.get("backupVideoItemLimit") ?? process.env.BACKUP_VIDEO_ITEMS_PER_SOURCE,
    2,
  );
  const submittedSourceLimit = readNonNegativeInt(
    url.searchParams.get("submittedSourceLimit") ?? process.env.SUBMITTED_SOURCE_LIMIT,
    8,
  );
  const run = await runIngestPipeline({
    sourceLimit,
    itemLimit,
    githubLimit,
    douyinSourceLimit,
    douyinItemLimit,
    backupVideoSourceLimit,
    backupVideoItemLimit,
    submittedSourceLimit,
  });
  const current = await readGeneratedFeed({ includeSkills: true, allowFallback: false });
  const hasIncomingFeed = run.posts.length > 0 || Object.keys(run.comments).length > 0;
  const mergedFeed = hasIncomingFeed
    ? mergeGeneratedFeed({
        current,
        incomingPosts: run.posts,
        incomingComments: run.comments,
        limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
      })
    : {
        ...current,
        policyVersion: current.policyVersion,
        updatedAt: current.updatedAt ?? run.fetchedAt,
      };
  const nextFeed =
    refreshAiComments || hasOutdatedAiComments(mergedFeed)
      ? await rebuildFeedAiComments(mergedFeed, { force: refreshAiComments })
      : mergedFeed;
  const wouldClearExistingFeed = current.posts.length > 0 && nextFeed.posts.length === 0;

  if (!dryRun && !wouldClearExistingFeed) {
    await writeGeneratedFeed(nextFeed);
  }
  const attemptedCount =
    sourceLimit + (githubLimit > 0 ? 1 : 0);
  const ingestOk = attemptedCount === 0 || run.primarySuccessCount > 0 || run.posts.length > 0;

  return Response.json(
    {
      ok: ingestOk,
      dryRun,
      persisted: !dryRun && !wouldClearExistingFeed,
      skippedPersistBecauseEmpty: wouldClearExistingFeed,
      refreshAiComments,
      fetchedAt: run.fetchedAt,
      sourceCount: run.sourceCount,
      githubRepoCount: run.githubRepoCount,
      newPostCount: run.posts.length,
      totalPostCount: nextFeed.posts.length,
      successCount: run.successCount,
      failureCount: run.failureCount,
      primarySuccessCount: run.primarySuccessCount,
      primaryFailureCount: run.primaryFailureCount,
      video: {
        attempted: run.video.attempted,
        sourceCount: run.video.sourceCount,
        successCount: run.video.successCount,
        failureCount: run.video.failureCount,
        postCount: run.video.postCount,
        sources: run.video.sources,
      },
      message:
        "已完成 AI 文章源和 GitHub 热门 Skill 抓取，并独立尝试抖音、YouTube、B站等视频源抓取。视频失败不会影响文章落地；GitHub、抖音和公开视频源使用真实公开互动指标，不提供互动指标的来源不会编造点赞数。",
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
  const entries = await mapWithConcurrency(feed.posts, 2, async (post) => {
    const currentComments = feed.comments[post.id] ?? [];
    const preservedComments = currentComments.filter((comment) => !comment.isAi);
    const currentAiComments = currentComments.filter((comment) => comment.isAi);

    if (!options.force && !shouldRefreshAiComments(currentAiComments)) {
      return [post.id, [...preservedComments, ...currentAiComments]] as [string, Comment[]];
    }

    const generated = await generateProductionAiComments({ post });
    if (generated.error) {
      console.warn("[cron/ingest] ai comment rebuild skipped", {
        postId: post.id,
        sourceName: post.sourceName,
        error: generated.error,
      });
      return [post.id, [...preservedComments, ...currentAiComments]] as [string, Comment[]];
    }

    return [post.id, [...preservedComments, ...generated.comments]] as [string, Comment[]];
  });

  entries.forEach(([postId, postComments]) => {
    comments[postId] = postComments;
  });

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
