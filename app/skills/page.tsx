import { SkillsClient } from "@/components/skills-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { mockPosts } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const generatedFeed = await readGeneratedFeed({ includeSkills: true });

  return <SkillsClient initialPosts={[...generatedFeed.posts, ...mockPosts]} />;
}
