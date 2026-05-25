import { InterestingClient } from "@/components/interesting-client";
import { readGeneratedWorks } from "@/lib/generated-works-store";

export const dynamic = "force-dynamic";

export default async function InterestingPage() {
  const worksFeed = await readGeneratedWorks({ allowFallback: true });

  return <InterestingClient initialWorks={worksFeed.works} />;
}
