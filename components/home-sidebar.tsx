"use client";

import Link from "next/link";
import {
  Flame,
  Hash,
  Rocket,
  Trophy,
  UsersRound,
} from "lucide-react";

import { PostScoreBadge } from "@/components/post-score-badge";
import { PostTypeBadge } from "@/components/post-type-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Post } from "@/lib/mock-data";
import { hotTags } from "@/lib/mock-data";
import { cn, formatCompactNumber } from "@/lib/utils";

export function HomeSidebar({
  posts,
  onTagClick,
}: {
  posts: Post[];
  onTagClick?: (tag: string) => void;
}) {
  const todayHot = [...posts]
    .sort((a, b) => b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2))
    .slice(0, 4);
  const productRanking = posts
    .filter((post) => post.type === "product" || post.type === "tool")
    .sort((a, b) => b.savesCount - a.savesCount)
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-violet-600" />
          <h3 className="font-black text-slate-950">今日热门</h3>
        </div>
        <div className="space-y-4">
          {todayHot.map((post, index) => (
            <Link
              href={`/post/${post.id}`}
              key={post.id}
              className="group grid grid-cols-[32px_1fr] gap-2.5"
            >
              <span className="relative">
                <PostScoreBadge post={post} size="compact" className="h-7 min-w-7 text-[11px]" />
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-black text-blue-700 shadow-soft">
                  {index + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-semibold leading-5 text-slate-700 group-hover:text-blue-700">
                  {post.title}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <PostTypeBadge type={post.type} className="px-2 py-0.5" />
                  {formatCompactNumber(post.likesCount)} 热度
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="font-black text-slate-950">本周 AI 产品榜</h3>
        </div>
        <div className="space-y-3">
          {productRanking.map((post, index) => (
            <Link
              href={`/post/${post.id}`}
              key={post.id}
              className="flex items-center gap-2.5 rounded-2xl p-2 transition-colors hover:bg-slate-50"
            >
              <span className="relative">
                <PostScoreBadge post={post} size="compact" className="h-8 min-w-8" />
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-black text-blue-700 shadow-soft">
                  {index + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-slate-800">
                  {post.title}
                </span>
                <span className="text-[11px] text-slate-400">
                  {formatCompactNumber(post.savesCount)} 人收藏
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

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

      <Card className="rounded-3xl p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <UsersRound className="h-5 w-5 text-emerald-500" />
          加入 AI 圈社区
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          每天一条高质量 AI 动态，和创作者、产品经理、独立开发者一起拆机会。
        </p>
        <Link
          href="/me"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-4 w-full")}
        >
          <Rocket className="h-4 w-4" />
          查看我的圈子
        </Link>
      </Card>
    </div>
  );
}
