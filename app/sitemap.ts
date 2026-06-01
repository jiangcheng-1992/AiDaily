import type { MetadataRoute } from "next";

import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import { mockPosts } from "@/lib/mock-data";
import { canonicalUrl } from "@/lib/seo";

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/interesting", priority: 0.9, changeFrequency: "hourly" },
  { path: "/ranking", priority: 0.75, changeFrequency: "daily" },
  { path: "/sources", priority: 0.65, changeFrequency: "weekly" },
  { path: "/submit", priority: 0.45, changeFrequency: "monthly" },
  { path: "/download", priority: 0.55, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [feed, worksFeed] = await Promise.all([
    readGeneratedFeed({ includeSkills: true, allowFallback: true }),
    readGeneratedWorks({ allowFallback: true }),
  ]);
  const now = new Date();
  const skillWorks = buildInterestingSkillWorks([...feed.posts, ...mockPosts]);
  const postRoutes = feed.posts.map((post) => ({
    url: canonicalUrl(`/post/${post.id}`),
    lastModified: safeDate(post.collectedAt || post.createdAt, now),
    changeFrequency: "weekly" as const,
    priority: post.featured ? 0.85 : 0.72,
  }));
  const workRoutes = [...skillWorks, ...worksFeed.works].map((work) => ({
    url: canonicalUrl(`/interesting/${work.id}`),
    lastModified: safeDate(work.publishedAt || work.createdAt, now),
    changeFrequency: "weekly" as const,
    priority: work.featured ? 0.82 : 0.68,
  }));

  return [
    ...staticRoutes.map((route) => ({
      url: canonicalUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...postRoutes,
    ...workRoutes,
  ];
}

function safeDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}
