import { readGeneratedFeed, readGeneratedFeedStatus } from "@/lib/generated-feed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let backgroundRebuildPromise: Promise<void> | null = null;

export async function GET(request: Request) {
  const feed = await readGeneratedFeed();
  const status = await readGeneratedFeedStatus();

  if (status.fallbackActive) {
    triggerBackgroundFeedRebuild(request);
  }

  return Response.json(
    {
      ok: true,
      updatedAt: feed.updatedAt,
      posts: feed.posts,
      comments: feed.comments,
      fallbackActive: status.fallbackActive,
      persistedPostCount: status.persistedPostCount,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function triggerBackgroundFeedRebuild(request: Request) {
  if (backgroundRebuildPromise) return;

  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !cronSecret) {
    console.warn("[feed] skipped background rebuild; CRON_SECRET is missing");
    return;
  }

  const url = new URL("/api/cron/ingest", request.url);
  url.searchParams.set("sourceLimit", process.env.SOURCE_FETCH_LIMIT ?? "6");
  url.searchParams.set("itemLimit", process.env.SOURCE_ITEMS_PER_SOURCE ?? "4");
  url.searchParams.set("githubLimit", process.env.GITHUB_SKILL_LIMIT ?? "4");
  url.searchParams.set("douyinSourceLimit", process.env.DOUYIN_SOURCE_LIMIT ?? "0");
  url.searchParams.set("backupVideoSourceLimit", process.env.BACKUP_VIDEO_SOURCE_LIMIT ?? "4");
  url.searchParams.set("backupVideoItemLimit", process.env.BACKUP_VIDEO_ITEMS_PER_SOURCE ?? "2");
  url.searchParams.set("submittedSourceLimit", process.env.SUBMITTED_SOURCE_LIMIT ?? "4");

  backgroundRebuildPromise = fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      ...(cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}),
    },
    cache: "no-store",
  })
    .then(async (response) => {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
      }
      console.info("[feed] background rebuild completed", text.slice(0, 500));
    })
    .catch((error) => {
      console.error(
        "[feed] background rebuild failed",
        error instanceof Error ? error.message : String(error),
      );
    })
    .finally(() => {
      backgroundRebuildPromise = null;
    });
}
