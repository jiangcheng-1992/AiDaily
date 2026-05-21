import { HomeClient } from "@/components/home-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";

export default async function HomePage() {
  const feed = await readGeneratedFeed();

  return <HomeClient initialPosts={feed.posts} />;
}
