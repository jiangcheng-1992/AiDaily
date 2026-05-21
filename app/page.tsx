import { HomeClient } from "@/components/home-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const feed = await readGeneratedFeed();

  return <HomeClient initialPosts={feed.posts} />;
}
