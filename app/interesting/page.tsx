import type { Metadata } from "next";

import { InterestingClient } from "@/components/interesting-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import {
  getWorkCategoryId,
  interestingCategories,
  interestingWorks,
  type WorkCategoryId,
  type WorkItem,
} from "@/lib/interesting-works";
import { mockPosts } from "@/lib/mock-data";
import { absoluteUrl } from "@/lib/seo";
import { triggerWorksRebuild } from "@/lib/works-rebuild";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "有点意思：AI 作品、网站、游戏、视频和 Skill",
  description:
    "发现 Product Hunt AI 产品、itch.io 浏览器游戏、YouTube/Vimeo AI 视频、Liblib 图片作品和 GitHub Skill。",
  alternates: {
    canonical: absoluteUrl("/interesting"),
  },
  openGraph: {
    title: "有点意思：AI 作品、网站、游戏、视频和 Skill",
    description: "聚合值得试玩、观看和收藏的 AI 作品与工具灵感。",
    url: absoluteUrl("/interesting"),
    type: "website",
  },
};

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
  const requestedTab = parseInterestingTab(resolvedSearchParams.tab);
  const baseWorks = mergeInterestingWorks([...skillWorks, ...worksFeed.works]).filter(isDisplayableInterestingWork);
  const works = mergeInterestingWorks([...baseWorks, ...getCategoryFallbacks(baseWorks)]);

  return (
    <InterestingClient
      initialWorks={works}
      initialCategory={requestedTab}
    />
  );
}

function mergeInterestingWorks(works: WorkItem[]) {
  const merged = new Map<string, WorkItem>();

  for (const work of works) {
    const key = work.externalUrl || work.githubUrl || work.videoUrl || work.id;
    if (!merged.has(key)) {
      merged.set(key, work);
    }
  }

  return Array.from(merged.values());
}

function isDisplayableInterestingWork(work: WorkItem) {
  return work.status === "approved";
}

function getCategoryFallbacks(works: WorkItem[]) {
  const usedFallbackIds = new Set<string>();
  const fallbackWorks: WorkItem[] = [];

  for (const category of interestingCategories) {
    if (category.id === "all") continue;
    const minimumCount = category.id === "game" ? 6 : 1;
    const currentCount = works.filter((work) => getWorkCategoryId(work) === category.id).length;
    const missingCount = Math.max(0, minimumCount - currentCount);

    if (missingCount === 0) continue;

    const categoryFallbacks = interestingWorks
      .filter((work) => getWorkCategoryId(work) === category.id && !usedFallbackIds.has(work.id))
      .slice(0, missingCount);

    for (const work of categoryFallbacks) {
      usedFallbackIds.add(work.id);
      fallbackWorks.push(work);
    }
  }

  return fallbackWorks;
}

function parseInterestingTab(tab?: string): WorkCategoryId | undefined {
  return interestingCategories.some((item) => item.id === tab) ? (tab as WorkCategoryId) : undefined;
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
