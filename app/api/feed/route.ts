import { buildHomeFeedPosts } from "@/lib/feed-view";
import { triggerFeedRebuild } from "@/lib/feed-rebuild";
import { readGeneratedFeed, readGeneratedFeedStatus } from "@/lib/generated-feed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let feed = await readGeneratedFeed({ allowFallback: false });
  let status = await readGeneratedFeedStatus();

  if (status.fallbackActive) {
    await waitForBackgroundFeedRebuild(request.url);
    feed = await readGeneratedFeed({ allowFallback: false });
    status = await readGeneratedFeedStatus();
  }

  const posts = buildHomeFeedPosts(feed.posts);

  if (status.fallbackActive) {
    triggerBackgroundFeedRebuild(request.url);
  }

  return Response.json(
    {
      ok: true,
      updatedAt: feed.updatedAt,
      posts,
      comments: feed.comments,
      feedPolicyVersion: feed.policyVersion,
      fallbackActive: status.fallbackActive,
      rebuilding: status.fallbackActive,
      persistedPostCount: status.persistedPostCount,
      visiblePostCount: posts.length,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function waitForBackgroundFeedRebuild(requestUrl: string) {
  const rebuild = triggerFeedRebuild(`api-feed:${new URL(requestUrl).pathname}`);
  await Promise.race([
    rebuild,
    new Promise((resolve) => setTimeout(resolve, 25_000)),
  ]);
}

function triggerBackgroundFeedRebuild(requestUrl: string) {
  void triggerFeedRebuild(`api-feed:${new URL(requestUrl).pathname}`)
    .catch((error) => {
      console.error(
        "[feed] background rebuild failed",
        error instanceof Error ? error.message : String(error),
      );
    });
}
