"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  MessageCircle,
  Play,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getWorkTypeLabel,
  interestingCategories,
  workMatchesInterestingCategory,
  type WorkCategoryId,
  type WorkItem,
} from "@/lib/interesting-works";
import { cn, formatCompactNumber, formatRelativeTime, formatVideoDuration } from "@/lib/utils";

export function InterestingClient({
  initialWorks,
  initialCategory = "all",
}: {
  initialWorks: WorkItem[];
  initialCategory?: WorkCategoryId;
}) {
  const category = initialCategory;
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  const approvedWorks = useMemo(() => {
    return initialWorks
      .filter((work) => work.status === "approved")
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.heatScore - a.heatScore);
  }, [initialWorks]);

  const worksByCategory = useMemo(() => {
    const grouped = Object.fromEntries(
      interestingCategories.map((item) => [item.id, [] as WorkItem[]]),
    ) as Record<WorkCategoryId, WorkItem[]>;

    for (const work of approvedWorks) {
      grouped.all.push(work);

      for (const item of interestingCategories) {
        if (item.id === "all") continue;
        if (workMatchesInterestingCategory(work, item.id)) {
          grouped[item.id].push(work);
        }
      }
    }

    return grouped;
  }, [approvedWorks]);

  const works = worksByCategory[category] ?? worksByCategory.all;

  const handleLike = useCallback((workId: string) => {
    setLikedIds((current) => {
      const next = new Set(current);
      if (next.has(workId)) next.delete(workId);
      else next.add(workId);
      return next;
    });
  }, []);

  const handleFavorite = useCallback((workId: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(workId)) next.delete(workId);
      else next.add(workId);
      return next;
    });
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.45rem] border border-white/80 bg-[#060a18] px-4 py-5 text-white shadow-[0_18px_52px_rgba(15,23,42,0.16)] ring-1 ring-slate-950/5 sm:rounded-[1.7rem] sm:px-7 sm:py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.32),transparent_30%),radial-gradient(circle_at_84%_26%,rgba(14,165,233,0.26),transparent_26%),linear-gradient(120deg,rgba(255,255,255,0.08),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute -left-14 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-4 h-24 w-24 rounded-full border border-blue-200/20" />
        <div className="absolute bottom-4 right-5 h-1 w-20 rounded-full bg-gradient-to-r from-blue-300 via-fuchsia-300 to-amber-200 opacity-70 shadow-[0_0_18px_rgba(129,140,248,0.55)] sm:right-7 sm:w-28" />
        <div className="relative flex min-h-[5.25rem] items-center sm:min-h-20">
          <h1 className="max-w-[18rem] text-[clamp(1.55rem,7vw,2.1rem)] font-black leading-tight tracking-[-0.04em] sm:max-w-full sm:whitespace-nowrap sm:text-[clamp(1.18rem,3.15vw,2.65rem)] sm:leading-none">
            发现全网好玩的 AI 作品、网站和灵感
          </h1>
        </div>
      </section>

      <div className="sticky top-16 z-20 mt-4 rounded-[1.5rem] border border-slate-100 bg-white/90 p-3 shadow-soft backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {interestingCategories.map((item) => {
            const href = item.id === "all" ? "/interesting?tab=all" : `/interesting?tab=${item.id}`;

            return (
              <Link
                key={item.id}
                href={href}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition-colors",
                  category === item.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {works.map((work, index) => (
          <InterestingWorkCard
            key={work.id}
            work={work}
            liked={likedIds.has(work.id)}
            favorited={favoriteIds.has(work.id)}
            priority={index < 4}
            onLike={handleLike}
            onFavorite={handleFavorite}
          />
        ))}
      </div>

      {works.length === 0 ? (
        <Card className="mt-6 rounded-[2rem] p-8 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 text-lg font-black text-slate-950">这个分类暂时没有作品</h2>
          <p className="mt-2 text-sm text-slate-500">换个分类看看，新的灵感很快会补上。</p>
        </Card>
      ) : null}
    </div>
  );
}

const InterestingWorkCard = memo(function InterestingWorkCard({
  work,
  liked,
  favorited,
  priority,
  onLike,
  onFavorite,
}: {
  work: WorkItem;
  liked: boolean;
  favorited: boolean;
  priority: boolean;
  onLike: (workId: string) => void;
  onFavorite: (workId: string) => void;
}) {
  const likeCount = work.likeCount + (liked ? 1 : 0);
  const favoriteCount = work.favoriteCount + (favorited ? 1 : 0);
  const isGame = work.categoryHint === "game";
  const actionHref = isGame && work.source !== "itchio" && work.externalUrl
    ? work.externalUrl
    : work.source === "itchio"
      ? `/interesting/${work.id}/play`
      : `/interesting/${work.id}`;

  return (
    <Card className="mb-4 inline-block w-full overflow-hidden rounded-[1.7rem] bg-white/95 p-0 align-top transition-transform duration-200 hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/interesting/${work.id}`} className="group block">
        <div className="relative overflow-hidden bg-slate-100">
          <img
            src={work.coverUrl}
            alt={work.title}
            loading={priority ? "eager" : "lazy"}
            className={cn(
              "w-full object-cover transition-transform duration-500 group-hover:scale-105",
              work.type === "image" || work.type === "prompt" ? "aspect-[4/5]" : "aspect-video",
            )}
          />
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-slate-800 shadow-soft backdrop-blur">
            {getWorkTypeLabel(work)}
          </div>
          {work.type === "video" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lift">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
          ) : null}
          {work.type === "video" ? (
            <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] font-black text-white">
              {formatVideoDuration(90_000 + work.heatScore * 1000)}
            </div>
          ) : null}
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/interesting/${work.id}`}
            className="line-clamp-2 text-[15px] font-black leading-6 text-slate-950 hover:text-blue-700"
          >
            {work.title}
          </Link>
          {work.featured ? (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-600">
              今日精选
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-500">
          {work.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {work.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
        <div className="mt-3 text-[11px] font-semibold text-slate-400">
          {formatRelativeTime(work.publishedAt ?? work.createdAt)}
        </div>
        {work.categoryHint === "skill" ? (
          <div className="mt-3 rounded-2xl bg-blue-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
            <span className="font-black text-blue-700">做什么：</span>
            {work.description}
          </div>
        ) : null}
        {work.source === "itchio" ? (
          <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
            无需下载 · 浏览器可玩
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex gap-3 text-[11px] font-bold text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCompactNumber(work.viewCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {formatCompactNumber(work.commentCount)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onLike(work.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-black transition-colors",
                liked ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500",
              )}
            >
              ❤️ {formatCompactNumber(likeCount)}
            </button>
            <button
              type="button"
              onClick={() => onFavorite(work.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-black transition-colors",
                favorited ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500",
              )}
            >
              ☆ {formatCompactNumber(favoriteCount)}
            </button>
          </div>
        </div>
        <Link
          href={actionHref}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-blue-700"
        >
          {work.categoryHint === "skill"
            ? "查看 Skill"
            : work.source === "itchio"
            ? "直接试玩"
            : isGame
              ? "开始体验"
            : work.source === "youtube" || work.source === "vimeo" || work.source === "liblib"
              ? "观看作品"
              : "查看作品"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
});
