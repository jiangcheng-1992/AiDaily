import { HomeClient } from "@/components/home-client";
import { buildHomeFeedPosts } from "@/lib/feed-view";
import { readGeneratedFeed } from "@/lib/generated-feed-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const feed = await readGeneratedFeed({ allowFallback: false });

  return <HomeClient initialPosts={buildHomeFeedPosts(feed.posts)} />;
}
