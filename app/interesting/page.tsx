import { InterestingClient } from "@/components/interesting-client";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { triggerWorksRebuild } from "@/lib/works-rebuild";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InterestingPage() {
  let worksFeed = await readGeneratedWorks({ allowFallback: false });

  if (worksFeed.works.length === 0) {
    await waitForWorksRebuild("interesting-page");
    worksFeed = await readGeneratedWorks({ allowFallback: false });
  }

  return <InterestingClient initialWorks={worksFeed.works} />;
}

async function waitForWorksRebuild(reason: string) {
  try {
    await Promise.race([
      triggerWorksRebuild(reason),
      new Promise((resolve) => setTimeout(resolve, 60_000)),
    ]);
  } catch (error) {
    console.error("[interesting] works rebuild failed", error);
  }
}
