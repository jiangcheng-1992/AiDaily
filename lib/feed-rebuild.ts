import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
import { runIngestPipeline } from "@/lib/ingest-pipeline";

let rebuildPromise: Promise<void> | null = null;

export function triggerFeedRebuild(reason: string) {
  if (rebuildPromise) return rebuildPromise;

  rebuildPromise = rebuildGeneratedFeed(reason).finally(() => {
    rebuildPromise = null;
  });

  return rebuildPromise;
}

async function rebuildGeneratedFeed(reason: string) {
  console.info("[feed-rebuild] started", { reason });

  const run = await runIngestPipeline({
    sourceLimit: readNonNegativeInt(process.env.SOURCE_FETCH_LIMIT, 12),
    itemLimit: readPositiveInt(process.env.SOURCE_ITEMS_PER_SOURCE, 6),
    githubLimit: readNonNegativeInt(process.env.GITHUB_SKILL_LIMIT, 8),
    douyinSourceLimit: readNonNegativeInt(process.env.DOUYIN_SOURCE_LIMIT, 12),
    douyinItemLimit: readPositiveInt(process.env.DOUYIN_ITEMS_PER_SOURCE, 2),
    backupVideoSourceLimit: readNonNegativeInt(process.env.BACKUP_VIDEO_SOURCE_LIMIT, 6),
    backupVideoItemLimit: readPositiveInt(process.env.BACKUP_VIDEO_ITEMS_PER_SOURCE, 2),
    submittedSourceLimit: readNonNegativeInt(process.env.SUBMITTED_SOURCE_LIMIT, 8),
    xSourceLimit: readNonNegativeInt(process.env.X_SOURCE_LIMIT, 24),
    xItemLimit: readPositiveInt(process.env.X_ITEMS_PER_SOURCE, 3),
    xKeywordLimit: readNonNegativeInt(process.env.X_KEYWORD_QUERY_LIMIT, 0),
    xPublishLimit: readNonNegativeInt(process.env.X_PUBLISH_LIMIT, 12),
    generateAiComments: false,
  });
  const current = await readGeneratedFeed({ includeSkills: true, allowFallback: false });

  if (run.posts.length === 0 && current.posts.length === 0) {
    throw new Error("[feed-rebuild] skipped persist because ingest returned no posts");
  }

  const nextFeed = mergeGeneratedFeed({
    current,
    incomingPosts: run.posts,
    incomingComments: run.comments,
    limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
  });

  await writeGeneratedFeed(nextFeed);

  console.info("[feed-rebuild] completed", {
    reason,
    newPostCount: run.posts.length,
    totalPostCount: nextFeed.posts.length,
    primarySuccessCount: run.primarySuccessCount,
    videoPostCount: run.video.postCount,
  });
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
