import { InterestingClient } from "@/components/interesting-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import { mockPosts } from "@/lib/mock-data";
import { triggerWorksRebuild } from "@/lib/works-rebuild";

export const revalidate = 60;

export default async function InterestingPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  let worksFeed = await readGeneratedWorks({ allowFallback: false });
  const generatedFeed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });
  const resolvedSearchParams = (await searchParams) ?? {};

  if (worksFeed.works.length === 0) {
    await waitForWorksRebuild("interesting-page");
    worksFeed = await readGeneratedWorks({ allowFallback: false });
  }

  const skillWorks = buildInterestingSkillWorks([...generatedFeed.posts, ...mockPosts]);
  const requestedTab = resolvedSearchParams.tab === "skill" ? "skill" : undefined;

  return (
    <InterestingClient
      initialWorks={[...skillWorks, ...worksFeed.works]}
      initialCategory={requestedTab}
    />
  );
}

async function waitForWorksRebuild(reason: string) {
  try {
    await Promise.race([
      triggerWorksRebuild(reason),
      new Promise((resolve) => setTimeout(resolve, 25_000)),
    ]);
  } catch (error) {
    console.error("[interesting] works rebuild failed", error);
  }
}
