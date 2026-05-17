import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
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
  const authError = validateCronRequest(request);

  if (authError) return authError;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
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
  const run = await runIngestPipeline({
    sourceLimit,
    itemLimit,
    githubLimit,
  });
  const current = await readGeneratedFeed();
  const nextFeed = mergeGeneratedFeed({
    current,
    incomingPosts: run.posts,
    incomingComments: run.comments,
    limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
  });

  if (!dryRun) {
    await writeGeneratedFeed(nextFeed);
  }

  return Response.json(
    {
      ok: true,
      dryRun,
      persisted: !dryRun,
      fetchedAt: run.fetchedAt,
      sourceCount: run.sourceCount,
      githubRepoCount: run.githubRepoCount,
      newPostCount: run.posts.length,
      totalPostCount: nextFeed.posts.length,
      successCount: run.successCount,
      failureCount: run.failureCount,
      message:
        "已完成 AI 信息源与 GitHub 热门 Skill 抓取，并为每条动态生成 AI 角色评论。GitHub 动态使用 stars/forks/issues 等真实公开指标；不提供互动指标的 RSS 源不会编造点赞数。",
      sources: run.sources,
      github: run.github,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function validateCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return null;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is required in production" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
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
