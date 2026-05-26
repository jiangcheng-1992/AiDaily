"use client";

import Link from "next/link";
import {
  Flame,
  Hash,
} from "lucide-react";

import { GoogleAdSlot } from "@/components/google-ad-slot";
import { PostScoreBadge } from "@/components/post-score-badge";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import type { Post } from "@/lib/mock-data";
import { hotTags } from "@/lib/mock-data";
import { formatCompactNumber } from "@/lib/utils";

const DEFAULT_SIDEBAR_AD_SLOT = "4376617489";
const sidebarAdSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT || DEFAULT_SIDEBAR_AD_SLOT;

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

  return (
    <div className="space-y-4 pb-10">
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

      <Card className="rounded-3xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">广告</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
            Google AdSense
          </span>
        </div>
        <GoogleAdSlot
          slot={sidebarAdSlot}
          className="min-h-[160px] rounded-[1.2rem] bg-slate-50/70 sm:min-h-[180px]"
          previewLabel="首页右侧热门标签下方广告位"
        />
      </Card>
    </div>
  );
}
