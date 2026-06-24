import { generateProductionAiComments } from "@/lib/ai-comment-service";
import { AI_COMMENT_GENERATION_VERSION } from "@/lib/ai-comment-roles";
import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
import {
  mergeGeneratedWorks,
  readGeneratedWorks,
  writeGeneratedWorks,
} from "@/lib/generated-works-store";
import { validateIngestRequest } from "@/lib/ingest-request-auth";
import type { GeneratedFeed } from "@/lib/generated-feed-store";
import { getWorkCategoryId, type WorkItem } from "@/lib/interesting-works";
import type { Comment } from "@/lib/mock-data";
import { runIngestPipeline } from "@/lib/ingest-pipeline";
import { fetchItchioWorks } from "@/lib/itchio-fetcher";
import { fetchLiblibWorks } from "@/lib/liblib-works-fetcher";
import { fetchProductHuntWorks } from "@/lib/product-hunt-fetcher";
import { fetchVimeoWorks } from "@/lib/vimeo-works-fetcher";
import { fetchYoutubeWorks } from "@/lib/youtube-works-fetcher";

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
    14,
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
  const xSourceLimit = readNonNegativeInt(
    url.searchParams.get("xSourceLimit") ?? process.env.X_SOURCE_LIMIT,
    24,
  );
  const xItemLimit = readPositiveInt(
    url.searchParams.get("xItemLimit") ?? process.env.X_ITEMS_PER_SOURCE,
    3,
  );
  const xKeywordLimit = readNonNegativeInt(
    url.searchParams.get("xKeywordLimit") ?? process.env.X_KEYWORD_QUERY_LIMIT,
    0,
  );
  const xPublishLimit = readNonNegativeInt(
    url.searchParams.get("xPublishLimit") ?? process.env.X_PUBLISH_LIMIT,
    12,
  );
  const productHuntWeeklyLimit = readNonNegativeInt(
    url.searchParams.get("productHuntWeeklyLimit") ?? process.env.PRODUCT_HUNT_WEEKLY_LIMIT,
    80,
  );
  const productHuntDailyLimit = readNonNegativeInt(
    url.searchParams.get("productHuntDailyLimit") ?? process.env.PRODUCT_HUNT_DAILY_LIMIT,
    40,
  );
  const itchioSourceLimit = readNonNegativeInt(
    url.searchParams.get("itchioSourceLimit") ?? process.env.ITCHIO_SOURCE_LIMIT,
    24,
  );
  const itchioPageLimit = readNonNegativeInt(
    url.searchParams.get("itchioPageLimit") ?? process.env.ITCHIO_PAGE_LIMIT,
    2,
  );
  const itchioReviewLimit = readNonNegativeInt(
    url.searchParams.get("itchioReviewLimit") ?? process.env.ITCHIO_REVIEW_LIMIT,
    90,
  );
  const itchioPublishLimit = readNonNegativeInt(
    url.searchParams.get("itchioPublishLimit") ?? process.env.ITCHIO_PUBLISH_LIMIT,
    24,
  );
  const itchioTargetCount = readNonNegativeInt(
    url.searchParams.get("itchioTargetCount") ?? process.env.ITCHIO_TARGET_COUNT,
    160,
  );
  const youtubeWorksSourceLimit = readNonNegativeInt(
    url.searchParams.get("youtubeWorksSourceLimit") ?? process.env.YOUTUBE_WORKS_SOURCE_LIMIT,
    25,
  );
  const youtubeWorksItemLimit = readNonNegativeInt(
    url.searchParams.get("youtubeWorksItemLimit") ?? process.env.YOUTUBE_WORKS_ITEM_LIMIT,
    5,
  );
  const youtubeWorksPublishLimit = readNonNegativeInt(
    url.searchParams.get("youtubeWorksPublishLimit") ?? process.env.YOUTUBE_WORKS_PUBLISH_LIMIT,
    16,
  );
  const liblibWorksItemLimit = readNonNegativeInt(
    url.searchParams.get("liblibWorksItemLimit") ?? process.env.LIBLIB_WORKS_ITEM_LIMIT,
    36,
  );
  const liblibWorksPublishLimit = readNonNegativeInt(
    url.searchParams.get("liblibWorksPublishLimit") ?? process.env.LIBLIB_WORKS_PUBLISH_LIMIT,
    16,
  );
  const vimeoWorksPageLimit = readNonNegativeInt(
    url.searchParams.get("vimeoWorksPageLimit") ?? process.env.VIMEO_WORKS_PAGE_LIMIT,
    3,
  );
  const vimeoWorksItemLimit = readNonNegativeInt(
    url.searchParams.get("vimeoWorksItemLimit") ?? process.env.VIMEO_WORKS_ITEM_LIMIT,
    12,
  );
  const vimeoWorksPublishLimit = readNonNegativeInt(
    url.searchParams.get("vimeoWorksPublishLimit") ?? process.env.VIMEO_WORKS_PUBLISH_LIMIT,
    14,
  );
  const replaceWorks = url.searchParams.get("replaceWorks") === "1";
  const run = await runIngestPipeline({
    sourceLimit,
    itemLimit,
    githubLimit,
    douyinSourceLimit,
    douyinItemLimit,
    backupVideoSourceLimit,
    backupVideoItemLimit,
    submittedSourceLimit,
    xSourceLimit,
    xItemLimit,
    xKeywordLimit,
    xPublishLimit,
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
  const currentWorks = await readGeneratedWorks({ allowFallback: false });
  const currentGameCount = countGameWorks(currentWorks.works);
  const effectiveItchioSettings = computeItchioFillSettings({
    currentGameCount,
    targetGameCount: itchioTargetCount,
    sourceLimit: itchioSourceLimit,
    pageLimit: itchioPageLimit,
    reviewLimit: itchioReviewLimit,
    publishLimit: itchioPublishLimit,
  });
  const shouldFetchProductHunt = productHuntWeeklyLimit > 0 || productHuntDailyLimit > 0;
  const shouldFetchItchio =
    effectiveItchioSettings.sourceLimit > 0 &&
    effectiveItchioSettings.pageLimit > 0 &&
    effectiveItchioSettings.reviewLimit > 0 &&
    effectiveItchioSettings.publishLimit > 0;
  const shouldFetchYoutubeWorks =
    youtubeWorksSourceLimit > 0 && youtubeWorksItemLimit > 0 && youtubeWorksPublishLimit > 0;
  const shouldFetchLiblibWorks = liblibWorksItemLimit > 0 && liblibWorksPublishLimit > 0;
  const shouldFetchVimeoWorks =
    vimeoWorksPageLimit > 0 && vimeoWorksItemLimit > 0 && vimeoWorksPublishLimit > 0;
  const [worksRun, itchioRun, youtubeWorksRun, liblibWorksRun, vimeoWorksRun] = await Promise.all([
    shouldFetchProductHunt
      ? fetchProductHuntWorks({
          weeklyLimit: productHuntWeeklyLimit,
          dailyLimit: productHuntDailyLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "producthunt" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
    shouldFetchItchio
      ? fetchItchioWorks({
          sourceLimit: effectiveItchioSettings.sourceLimit,
          pageLimit: effectiveItchioSettings.pageLimit,
          reviewLimit: effectiveItchioSettings.reviewLimit,
          publishLimit: effectiveItchioSettings.publishLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "itchio" as const,
          count: 0,
          works: [],
          error: undefined,
          diagnostics: undefined,
        }),
    shouldFetchYoutubeWorks
      ? fetchYoutubeWorks({
          sourceLimit: youtubeWorksSourceLimit,
          itemLimit: youtubeWorksItemLimit,
          publishLimit: youtubeWorksPublishLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "youtube" as const,
          count: 0,
          works: [],
          error: undefined,
          diagnostics: undefined,
        }),
    shouldFetchLiblibWorks
      ? fetchLiblibWorks({
          itemLimit: liblibWorksItemLimit,
          publishLimit: liblibWorksPublishLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "liblib" as const,
          count: 0,
          works: [],
          error: undefined,
          diagnostics: undefined,
        }),
    shouldFetchVimeoWorks
      ? fetchVimeoWorks({
          pageLimit: vimeoWorksPageLimit,
          itemLimit: vimeoWorksItemLimit,
          publishLimit: vimeoWorksPublishLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "vimeo" as const,
          count: 0,
          works: [],
          error: undefined,
          diagnostics: undefined,
        }),
  ]);
  const incomingWorks = [
    ...worksRun.works,
    ...itchioRun.works,
    ...youtubeWorksRun.works,
    ...liblibWorksRun.works,
    ...vimeoWorksRun.works,
  ];
  const worksSourceStatus = {
    ...(shouldFetchProductHunt
      ? {
          producthunt: {
            ok: worksRun.ok,
            count: worksRun.count,
            fetchedAt: run.fetchedAt,
            error: worksRun.error,
          },
        }
      : {}),
    ...(shouldFetchItchio
      ? {
          itchio: {
            ok: itchioRun.ok,
            count: itchioRun.count,
            fetchedAt: run.fetchedAt,
            error: itchioRun.error,
          },
        }
      : {}),
    ...(shouldFetchYoutubeWorks
      ? {
          youtube: {
            ok: youtubeWorksRun.ok,
            count: youtubeWorksRun.count,
            fetchedAt: run.fetchedAt,
            error: youtubeWorksRun.error,
          },
        }
      : {}),
    ...(shouldFetchVimeoWorks
      ? {
          vimeo: {
            ok: vimeoWorksRun.ok,
            count: vimeoWorksRun.count,
            fetchedAt: run.fetchedAt,
            error: vimeoWorksRun.error,
          },
        }
      : {}),
    ...(shouldFetchLiblibWorks
      ? {
          liblib: {
            ok: liblibWorksRun.ok,
            count: liblibWorksRun.count,
            fetchedAt: run.fetchedAt,
            error: liblibWorksRun.error,
          },
        }
      : {}),
  };
  const nextWorks = mergeGeneratedWorks({
    current: currentWorks,
    incomingWorks,
    sourceStatus: worksSourceStatus,
    limit: readPositiveInt(process.env.GENERATED_WORKS_LIMIT, 320),
  });
  const wouldShrinkExistingWorks =
    !replaceWorks &&
    currentWorks.works.length > 0 &&
    nextWorks.works.length < currentWorks.works.length;
  const nextGameCount = countGameWorks(nextWorks.works);

  if (!dryRun && incomingWorks.length > 0 && !wouldShrinkExistingWorks) {
    await writeGeneratedWorks(nextWorks);
  }

  const feedAttempted =
    sourceLimit > 0 ||
    githubLimit > 0 ||
    douyinSourceLimit > 0 ||
    backupVideoSourceLimit > 0 ||
    submittedSourceLimit > 0 ||
    xSourceLimit > 0 ||
    xKeywordLimit > 0;
  const feedOk =
    !feedAttempted ||
    run.primarySuccessCount > 0 ||
    run.posts.length > 0 ||
    run.video.successCount > 0 ||
    run.x.count > 0;
  const worksAttempted =
    shouldFetchProductHunt ||
    shouldFetchItchio ||
    shouldFetchYoutubeWorks ||
    shouldFetchLiblibWorks ||
    shouldFetchVimeoWorks;
  const worksOk =
    !worksAttempted ||
    incomingWorks.length > 0 ||
    worksRun.ok ||
    itchioRun.ok ||
    youtubeWorksRun.ok ||
    liblibWorksRun.ok ||
    vimeoWorksRun.ok;
  const ingestOk = feedOk && worksOk;

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
      x: run.x,
      works: {
        productHunt: {
          ok: worksRun.ok,
          count: worksRun.count,
          error: worksRun.error,
          configured: Boolean(process.env.PRODUCT_HUNT_TOKEN || process.env.PRODUCTHUNT_TOKEN),
          skipped: !shouldFetchProductHunt,
        },
        itchio: {
          ok: itchioRun.ok,
          count: itchioRun.count,
          error: itchioRun.error,
          diagnostics: itchioRun.diagnostics,
          sourceLimit: effectiveItchioSettings.sourceLimit,
          pageLimit: effectiveItchioSettings.pageLimit,
          reviewLimit: effectiveItchioSettings.reviewLimit,
          publishLimit: effectiveItchioSettings.publishLimit,
          targetCount: itchioTargetCount,
          currentGameCount,
          nextGameCount,
          skipped: !shouldFetchItchio,
        },
        youtube: {
          ok: youtubeWorksRun.ok,
          count: youtubeWorksRun.count,
          error: youtubeWorksRun.error,
          diagnostics: youtubeWorksRun.diagnostics,
          sourceLimit: youtubeWorksSourceLimit,
          itemLimit: youtubeWorksItemLimit,
          publishLimit: youtubeWorksPublishLimit,
          skipped: !shouldFetchYoutubeWorks,
        },
        liblib: {
          ok: liblibWorksRun.ok,
          count: liblibWorksRun.count,
          error: liblibWorksRun.error,
          diagnostics: liblibWorksRun.diagnostics,
          itemLimit: liblibWorksItemLimit,
          publishLimit: liblibWorksPublishLimit,
          skipped: !shouldFetchLiblibWorks,
        },
        vimeo: {
          ok: vimeoWorksRun.ok,
          count: vimeoWorksRun.count,
          error: vimeoWorksRun.error,
          diagnostics: vimeoWorksRun.diagnostics,
          pageLimit: vimeoWorksPageLimit,
          itemLimit: vimeoWorksItemLimit,
          publishLimit: vimeoWorksPublishLimit,
          skipped: !shouldFetchVimeoWorks,
        },
        previousWorkCount: currentWorks.works.length,
        totalWorkCount: nextWorks.works.length,
        persisted: !dryRun && incomingWorks.length > 0 && !wouldShrinkExistingWorks,
        skippedPersistBecauseWorksWouldShrink: wouldShrinkExistingWorks,
      },
      message:
        "已完成 AI 文章源、X 权威账号雷达、GitHub 热门 Skill、Product Hunt AI 作品、itch.io 浏览器小游戏，以及 YouTube / Liblib / Vimeo 视频作品抓取。视频、X 或作品源失败不会影响文章落地。",
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

function countGameWorks(works: WorkItem[]) {
  return works.filter((work) => getWorkCategoryId(work) === "game").length;
}

function computeItchioFillSettings({
  currentGameCount,
  targetGameCount,
  sourceLimit,
  pageLimit,
  reviewLimit,
  publishLimit,
}: {
  currentGameCount: number;
  targetGameCount: number;
  sourceLimit: number;
  pageLimit: number;
  reviewLimit: number;
  publishLimit: number;
}) {
  const deficit = Math.max(0, targetGameCount - currentGameCount);

  if (deficit === 0) {
    return {
      sourceLimit,
      pageLimit,
      reviewLimit,
      publishLimit,
    };
  }

  return {
    sourceLimit: Math.max(sourceLimit, 24),
    pageLimit: Math.max(pageLimit, Math.min(3, 1 + Math.ceil(deficit / 40))),
    reviewLimit: Math.max(reviewLimit, Math.min(150, Math.max(90, deficit * 2))),
    publishLimit: Math.max(publishLimit, Math.min(48, Math.max(24, deficit))),
  };
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
