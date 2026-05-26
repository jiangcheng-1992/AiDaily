import { HomeClient } from "@/components/home-client";
import { buildHomeFeedPosts } from "@/lib/feed-view";
import { triggerFeedRebuild } from "@/lib/feed-rebuild";
import { readGeneratedFeed } from "@/lib/generated-feed-store";

export const revalidate = 60;

export default async function HomePage() {
  let feed = await readGeneratedFeed({ allowFallback: false });

  if (feed.posts.length === 0) {
    await waitForFeedRebuild("home-page");
    feed = await readGeneratedFeed({ allowFallback: false });
  }

  return <HomeClient initialPosts={buildHomeFeedPosts(feed.posts)} />;
}

async function waitForFeedRebuild(reason: string) {
  try {
    await Promise.race([
      triggerFeedRebuild(reason),
      new Promise((resolve) => setTimeout(resolve, 25_000)),
    ]);
  } catch (error) {
    console.error("[home] feed rebuild failed", error);
  }
}
