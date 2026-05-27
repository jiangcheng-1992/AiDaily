"use client";

import Link from "next/link";
import {
  Flame,
  Hash,
  Trophy,
} from "lucide-react";

import { GoogleAdSlot } from "@/components/google-ad-slot";
import { Card } from "@/components/ui/card";
import { shouldRenderGoogleAd } from "@/lib/google-ads";
import {
  getWorkCategoryId,
  type WorkItem,
} from "@/lib/interesting-works";
import type { Post } from "@/lib/mock-data";
import { hotTags } from "@/lib/mock-data";
import { cn, formatRelativeTime } from "@/lib/utils";

const DEFAULT_SIDEBAR_AD_SLOT = "4376617489";
const sidebarAdSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT || DEFAULT_SIDEBAR_AD_SLOT;
const showSidebarAd = shouldRenderGoogleAd(sidebarAdSlot);

export function HomeSidebar({
  posts,
  works,
  skillWorks,
  onTagClick,
}: {
  posts: Post[];
  works: WorkItem[];
  skillWorks: WorkItem[];
  onTagClick?: (tag: string) => void;
}) {
  const todayPosters = buildSidebarPosterGroup({
    posts,
    works,
    skillWorks,
    periodDays: 1,
  });
  const weeklyPosters = buildSidebarPosterGroup({
    posts,
    works,
    skillWorks,
    periodDays: 7,
  });

  return (
    <div className="space-y-4 pb-10">
      <PosterSection
        title="今日热门"
        subtitle="文章 / 视频 / 游戏 / 网站 / Skill"
        icon={<Flame className="h-5 w-5 text-violet-600" />}
        items={todayPosters}
      />

      <PosterSection
        title="本周热门"
        subtitle="过去 7 天更新最值得看"
        icon={<Trophy className="h-5 w-5 text-amber-500" />}
        items={weeklyPosters}
      />

      <Card className="rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Hash className="h-5 w-5 text-blue-600" />
          <h3 className="font-black text-slate-950">热门标签</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {hotTags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              #{tag}
            </button>
          ))}
        </div>
      </Card>

      {showSidebarAd ? (
        <Card className="rounded-3xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">广告</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              Google AdSense
            </span>
          </div>
          <div className="h-[128px] max-h-[128px] overflow-hidden rounded-[1.2rem] border border-slate-100 bg-slate-50/70 sm:h-[144px] sm:max-h-[144px]">
            <GoogleAdSlot slot={sidebarAdSlot} className="h-full w-full" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

type SidebarPosterItem = {
  id: string;
  title: string;
  href: string;
  coverUrl?: string;
  kindLabel: string;
  meta: string;
  accentClassName: string;
};

function PosterSection({
  title,
  subtitle,
  icon,
  items,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: SidebarPosterItem[];
}) {
  return (
    <Card className="rounded-3xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="font-black text-slate-950">{title}</h3>
            <p className="text-[11px] font-semibold text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
          TOP 5
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group block overflow-hidden rounded-[1.35rem] border border-slate-100 bg-white"
          >
            <div className="relative h-[96px] overflow-hidden">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className={cn(
                    "h-full w-full bg-gradient-to-br",
                    item.accentClassName,
                  )}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/82 via-slate-950/50 to-slate-950/15" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-slate-800">
                    {item.kindLabel}
                  </span>
                  <span className="rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">
                    {item.meta}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-[13px] font-black leading-5 text-white">
                  {item.title}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function buildSidebarPosterGroup({
  posts,
  works,
  skillWorks,
  periodDays,
}: {
  posts: Post[];
  works: WorkItem[];
  skillWorks: WorkItem[];
  periodDays: number;
}) {
  return [
    pickLatestArticlePoster(posts, periodDays),
    pickLatestWorkPoster(works, periodDays, "video"),
    pickLatestWorkPoster(works, periodDays, "game"),
    pickLatestWorkPoster(works, periodDays, "website"),
    pickLatestSkillPoster(skillWorks, periodDays),
  ].filter(Boolean) as SidebarPosterItem[];
}

function pickLatestArticlePoster(posts: Post[], periodDays: number): SidebarPosterItem | null {
  const candidate = pickLatest(
    posts.filter((post) => post.type !== "skill" && post.type !== "video"),
    periodDays,
    (post) => post.collectedAt || post.createdAt,
    (post) => post.likesCount + post.commentsCount * 2 + post.savesCount * 1.5,
  );

  if (!candidate) return null;

  return {
    id: `article-${candidate.id}`,
    title: candidate.title,
    href: `/post/${candidate.id}`,
    coverUrl: candidate.coverImageUrl || candidate.imageUrls?.[0] || firstContentImage(candidate),
    kindLabel: "文章",
    meta: formatRelativeTime(candidate.collectedAt || candidate.createdAt),
    accentClassName: "from-blue-500 via-cyan-500 to-indigo-600",
  };
}

function pickLatestWorkPoster(
  works: WorkItem[],
  periodDays: number,
  target: "video" | "game" | "website",
): SidebarPosterItem | null {
  const filtered = works.filter((work) => {
    const category = getWorkCategoryId(work);
    if (target === "video") return category === "media" && work.type === "video";
    if (target === "game") return category === "game";
    return category === "website-agent";
  });

  const candidate = pickLatest(
    filtered,
    periodDays,
    (work) => work.publishedAt || work.createdAt,
    (work) => work.heatScore + work.likeCount * 0.2 + work.commentCount * 1.2,
  );

  if (!candidate) return null;

  return {
    id: `${target}-${candidate.id}`,
    title: candidate.title,
    href: `/interesting/${candidate.id}`,
    coverUrl: candidate.coverUrl,
    kindLabel: target === "video" ? "视频" : target === "game" ? "游戏" : "网站",
    meta: formatRelativeTime(candidate.publishedAt ?? candidate.createdAt),
    accentClassName:
      target === "video"
        ? "from-fuchsia-500 via-violet-500 to-blue-600"
        : target === "game"
          ? "from-emerald-500 via-teal-500 to-cyan-600"
          : "from-amber-500 via-orange-500 to-rose-500",
  };
}

function pickLatestSkillPoster(skillWorks: WorkItem[], periodDays: number): SidebarPosterItem | null {
  const candidate = pickLatest(
    skillWorks,
    periodDays,
    (work) => work.publishedAt || work.createdAt,
    (work) => work.heatScore + work.favoriteCount * 0.5 + work.likeCount * 0.2,
  );

  if (!candidate) return null;

  return {
    id: `skill-${candidate.id}`,
    title: candidate.title,
    href: `/interesting/${candidate.id}`,
    coverUrl: candidate.coverUrl,
    kindLabel: "Skill",
    meta: formatRelativeTime(candidate.publishedAt ?? candidate.createdAt),
    accentClassName: "from-lime-500 via-emerald-500 to-green-600",
  };
}

function pickLatest<T>(
  items: T[],
  periodDays: number,
  getDate: (item: T) => string | undefined,
  getScore: (item: T) => number,
) {
  const threshold = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const withinWindow = items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= threshold;
  });
  const source = withinWindow.length > 0 ? withinWindow : items;

  return [...source].sort((left, right) => {
    const rightTime = new Date(getDate(right) ?? 0).getTime();
    const leftTime = new Date(getDate(left) ?? 0).getTime();
    return rightTime - leftTime || getScore(right) - getScore(left);
  })[0];
}

function firstContentImage(post: Post) {
  return post.contentBlocks?.find((block) => block.type === "image")?.url;
}
