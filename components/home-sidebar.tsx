"use client";

import Link from "next/link";
import {
  Flame,
  Hash,
  Trophy,
} from "lucide-react";

import { AiFortuneEntry } from "@/components/ai-fortune-experience";
import { GoogleAdSlot } from "@/components/google-ad-slot";
import { Card } from "@/components/ui/card";
import { shouldRenderGoogleAd } from "@/lib/google-ads";
import {
  getWorkCategoryId,
  type WorkItem,
} from "@/lib/interesting-works";
import { isGeneratedPreviewImageUrl } from "@/lib/image-url";
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
    excludedPosterIds: new Set(todayPosters.map((item) => item.id)),
  });

  return (
    <div className="space-y-4 pb-10">
      <AiFortuneEntry />

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
            className="group block rounded-[1.35rem] border border-slate-100 bg-white p-3"
          >
            <div className="relative h-[78px] overflow-hidden rounded-[1rem]">
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
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/20" />
              <span
                className={cn(
                  "absolute left-2.5 top-2.5 inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm backdrop-blur",
                  getPosterKindClassName(item.kindLabel),
                )}
              >
                {item.kindLabel}
              </span>
              <span className="absolute bottom-2.5 right-2.5 shrink-0 rounded-full bg-slate-950/72 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur">
                {item.meta}
              </span>
            </div>
            <div className="pt-2.5">
              <div className="line-clamp-2 text-[13px] font-black leading-5 text-slate-900 transition-colors group-hover:text-blue-700">
                {item.title}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function getPosterKindClassName(kindLabel: string) {
  switch (kindLabel) {
    case "文章":
      return "border-blue-200 bg-blue-50/95 text-blue-700";
    case "视频":
      return "border-fuchsia-200 bg-fuchsia-50/95 text-fuchsia-700";
    case "游戏":
      return "border-emerald-200 bg-emerald-50/95 text-emerald-700";
    case "网站":
      return "border-amber-200 bg-amber-50/95 text-amber-700";
    case "Skill":
      return "border-violet-200 bg-violet-50/95 text-violet-700";
    default:
      return "border-slate-200 bg-white/95 text-slate-800";
  }
}

function buildSidebarPosterGroup({
  posts,
  works,
  skillWorks,
  periodDays,
  excludedPosterIds,
}: {
  posts: Post[];
  works: WorkItem[];
  skillWorks: WorkItem[];
  periodDays: number;
  excludedPosterIds?: Set<string>;
}) {
  return [
    pickLatestArticlePoster(posts, periodDays, excludedPosterIds),
    pickLatestWorkPoster(works, periodDays, "video", excludedPosterIds),
    pickLatestWorkPoster(works, periodDays, "game", excludedPosterIds),
    pickLatestWorkPoster(works, periodDays, "website", excludedPosterIds),
    pickLatestSkillPoster(skillWorks, periodDays, excludedPosterIds),
  ].filter(Boolean) as SidebarPosterItem[];
}

function pickLatestArticlePoster(
  posts: Post[],
  periodDays: number,
  excludedPosterIds?: Set<string>,
): SidebarPosterItem | null {
  const candidate = pickLatest(
    posts.filter((post) => post.type !== "skill" && post.type !== "video"),
    periodDays,
    (post) => `article-${post.id}`,
    (post) => post.collectedAt || post.createdAt,
    (post) => post.likesCount + post.commentsCount * 2 + post.savesCount * 1.5,
    excludedPosterIds,
  );

  if (!candidate) return null;

  return {
    id: `article-${candidate.id}`,
    title: candidate.title,
    href: `/post/${candidate.id}`,
    coverUrl: pickReliableImage(
      candidate.coverImageUrl,
      candidate.imageUrls?.[0],
      firstContentImage(candidate),
    ),
    kindLabel: "文章",
    meta: formatRelativeTime(candidate.collectedAt || candidate.createdAt),
    accentClassName: "from-blue-500 via-cyan-500 to-indigo-600",
  };
}

function pickLatestWorkPoster(
  works: WorkItem[],
  periodDays: number,
  target: "video" | "game" | "website",
  excludedPosterIds?: Set<string>,
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
    (work) => `${target}-${work.id}`,
    (work) => work.publishedAt || work.createdAt,
    (work) => work.heatScore + work.likeCount * 0.2 + work.commentCount * 1.2,
    excludedPosterIds,
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

function pickLatestSkillPoster(
  skillWorks: WorkItem[],
  periodDays: number,
  excludedPosterIds?: Set<string>,
): SidebarPosterItem | null {
  const candidate = pickLatest(
    skillWorks,
    periodDays,
    (work) => `skill-${work.id}`,
    (work) => work.publishedAt || work.createdAt,
    (work) => work.heatScore + work.favoriteCount * 0.5 + work.likeCount * 0.2,
    excludedPosterIds,
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
  getId: (item: T) => string,
  getDate: (item: T) => string | undefined,
  getScore: (item: T) => number,
  excludedPosterIds?: Set<string>,
) {
  const threshold = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const withinWindow = items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= threshold;
  });
  const source = withinWindow.length > 0 ? withinWindow : items;
  const preferred = excludedPosterIds?.size
    ? source.filter((item) => !excludedPosterIds.has(getId(item)))
    : source;
  const candidatePool = preferred.length > 0 ? preferred : source;

  return [...candidatePool].sort((left, right) => {
    const rightTime = new Date(getDate(right) ?? 0).getTime();
    const leftTime = new Date(getDate(left) ?? 0).getTime();
    return rightTime - leftTime || getScore(right) - getScore(left);
  })[0];
}

function firstContentImage(post: Post) {
  return post.contentBlocks?.find((block) => block.type === "image")?.url;
}

function pickReliableImage(...urls: Array<string | null | undefined>) {
  return urls.find((url) => url && !isGeneratedPreviewImageUrl(url)) ?? undefined;
}
