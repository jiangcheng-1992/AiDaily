"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  interestingCategories,
  workSourceLabels,
  workTypeLabels,
  type WorkItem,
  type WorkType,
} from "@/lib/interesting-works";
import { cn, formatCompactNumber, formatRelativeTime, formatVideoDuration } from "@/lib/utils";

type CategoryId = "all" | WorkType;

export function InterestingClient({ initialWorks }: { initialWorks: WorkItem[] }) {
  const [category, setCategory] = useState<CategoryId>("all");
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const works = useMemo(() => {
    return initialWorks
      .filter((work) => work.status === "approved")
      .filter((work) => category === "all" || work.type === category)
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.heatScore - a.heatScore);
  }, [category, initialWorks]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[#050816] px-5 py-8 text-white shadow-lift sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.42),transparent_32%),radial-gradient(circle_at_82%_26%,rgba(14,165,233,0.32),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.24),transparent_34%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute -left-20 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute -right-14 top-6 h-32 w-32 rounded-full border border-blue-300/20" />
        <div className="absolute bottom-5 right-8 h-1.5 w-36 rounded-full bg-gradient-to-r from-blue-400 via-fuchsia-400 to-amber-300 opacity-80 blur-[1px]" />
        <div className="relative flex min-h-28 items-center">
          <h1 className="max-w-full whitespace-nowrap text-[clamp(1.45rem,4vw,3.8rem)] font-black leading-none tracking-tight">
            发现全网好玩的 AI 作品、网站和灵感
          </h1>
        </div>
      </section>

      <div className="sticky top-16 z-20 mt-4 rounded-[1.5rem] border border-slate-100 bg-white/90 p-3 shadow-soft backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {interestingCategories.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition-colors",
                category === item.id
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {works.map((work, index) => (
          <InterestingWorkCard
            key={work.id}
            work={work}
            liked={likedIds.includes(work.id)}
            favorited={favoriteIds.includes(work.id)}
            priority={index < 4}
            onLike={() =>
              setLikedIds((current) =>
                current.includes(work.id)
                  ? current.filter((id) => id !== work.id)
                  : [...current, work.id],
              )
            }
            onFavorite={() =>
              setFavoriteIds((current) =>
                current.includes(work.id)
                  ? current.filter((id) => id !== work.id)
                  : [...current, work.id],
              )
            }
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

function InterestingWorkCard({
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
  onLike: () => void;
  onFavorite: () => void;
}) {
  const likeCount = work.likeCount + (liked ? 1 : 0);
  const favoriteCount = work.favoriteCount + (favorited ? 1 : 0);

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
            {workTypeLabels[work.type]}
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
        <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-slate-500">
          {work.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {work.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
          <span className="truncate">
            {workSourceLabels[work.source]} · {work.authorName ?? "匿名作者"}
          </span>
          <span>{formatRelativeTime(work.publishedAt ?? work.createdAt)}</span>
        </div>
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
              onClick={onLike}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-black transition-colors",
                liked ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500",
              )}
            >
              ❤️ {formatCompactNumber(likeCount)}
            </button>
            <button
              type="button"
              onClick={onFavorite}
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
          href={`/interesting/${work.id}`}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-blue-700"
        >
          查看作品
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
