import { HomeClient } from "@/components/home-client";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { buildHomeFeedPosts } from "@/lib/feed-view";
import { triggerFeedRebuild } from "@/lib/feed-rebuild";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";

export const revalidate = 60;

export default async function HomePage() {
  let feed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });

  if (feed.posts.length === 0) {
    await waitForFeedRebuild("home-page");
    feed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });
  }

  const articlePosts = buildHomeFeedPosts(feed.posts.filter((post) => post.type !== "skill"));
  const skillWorks = buildInterestingSkillWorks(feed.posts);
  const worksFeed = await readGeneratedWorks({ allowFallback: false });

  return (
    <HomeClient
      initialPosts={articlePosts}
      initialWorks={worksFeed.works}
      initialSkillWorks={skillWorks}
    />
  );
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
