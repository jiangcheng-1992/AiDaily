"use client";

import Link from "next/link";
import {
  Bookmark,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Flame,
  MessageCircle,
  Trophy,
} from "lucide-react";

import { ExternalImage } from "@/components/external-image";
import { PostScoreBadge } from "@/components/post-score-badge";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import { getDisplayImageUrl } from "@/lib/image-url";
import type { Post } from "@/lib/mock-data";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isTodayPost(post: Post) {
  const referenceTime = getRankingTime(post);
  return referenceTime >= getStartOfToday().getTime() || Date.now() - referenceTime <= DAY_MS;
}

export function RankingClient() {
  const { allPosts, getPostStats } = useAiCircleStore();

  const withScore = (post: Post) => {
    const stats = getPostStats(post);
    return (
      stats.likesCount +
      stats.commentsCount * 2 +
      stats.savesCount +
      Math.max(0, post.likesCount) +
      Math.max(0, post.commentsCount) * 2
    );
  };

  const todayCandidates = [...allPosts]
    .filter(isTodayPost)
    .sort(
      (a, b) =>
        withScore(b) - withScore(a) ||
        getRankingTime(b) - getRankingTime(a),
    )
    .slice(0, 5);
  const todayHot =
    todayCandidates.length > 0
      ? todayCandidates
      : [...allPosts].sort((a, b) => getRankingTime(b) - getRankingTime(a)).slice(0, 5);
  const weekHot = [...allPosts].sort((a, b) => withScore(b) - withScore(a)).slice(0, 5);
  const commentsHot = [...allPosts]
    .sort((a, b) => getPostStats(b).commentsCount - getPostStats(a).commentsCount)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <ChartNoAxesColumnIncreasing className="h-4 w-4" />
          AI圈榜单
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          今天 AI 圈都在看什么
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingSection
          title="今日热门"
          icon={Flame}
          posts={todayHot}
          metric={(post) => `${formatCompactNumber(withScore(post))} 热度`}
          note={todayCandidates.length > 0 ? "今日新鲜内容" : "暂无今日新内容，展示最近更新"}
        />
        <RankingSection
          title="本周热门"
          icon={Trophy}
          posts={weekHot}
          metric={(post) => `${formatCompactNumber(withScore(post))} 综合分`}
          note="按互动和基础热度排序"
        />
        <RankingSection
          title="评论最多内容"
          icon={MessageCircle}
          posts={commentsHot}
          metric={(post) => `${formatCompactNumber(getPostStats(post).commentsCount)} 评论`}
          className="lg:col-span-2"
          note="优先展示讨论度最高的内容"
        />
      </div>
    </div>
  );
}

function RankingSection({
  title,
  icon: Icon,
  posts,
  metric,
  className,
  note,
}: {
  title: string;
  icon: typeof Flame;
  posts: Post[];
  metric: (post: Post) => string;
  className?: string;
  note?: string;
}) {
  return (
    <Card className={className ? `${className} rounded-[2rem] p-5` : "rounded-[2rem] p-5"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            {note ? (
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{note}</p>
            ) : null}
          </div>
        </div>
        <Bookmark className="h-5 w-5 text-slate-300" />
      </div>
      <div className="space-y-3">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <RankingItem
              index={index}
              key={post.id}
              metric={metric(post)}
              post={post}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm font-semibold leading-6 text-slate-500">
            当前榜单还在等待新内容进入，稍后抓取完成后会自动恢复。
          </div>
        )}
      </div>
    </Card>
  );
}

function RankingItem({ post, index, metric }: { post: Post; index: number; metric: string }) {
  const imageUrl = getRankingImage(post);

  return (
    <Link
      href={`/post/${post.id}`}
      className="group grid grid-cols-[88px_1fr] gap-3 rounded-3xl border border-transparent bg-white p-2.5 transition-all hover:border-blue-100 hover:bg-blue-50/50 hover:shadow-soft sm:grid-cols-[108px_1fr] sm:gap-4"
    >
      <span className="relative block h-16 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 via-violet-100 to-slate-100 sm:h-[72px]">
        {imageUrl ? (
          <ExternalImage
            src={imageUrl}
            alt={post.title}
            loading="lazy"
            className="h-16 w-full object-cover object-top transition-transform duration-300 group-hover:scale-105 sm:h-[72px]"
            fallback={<RankingImageFallback post={post} />}
          />
        ) : (
          <RankingImageFallback post={post} />
        )}
        <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-white/92 px-1.5 text-xs font-black text-blue-700 shadow-soft">
          {index + 1}
        </span>
      </span>

      <span className="min-w-0 py-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <PostTypeBadge type={post.type} className="px-2 py-0.5" />
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatRelativeTime(post.collectedAt ?? post.createdAt)}
          </span>
        </span>
        <span className="mt-1.5 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950 group-hover:text-blue-700 sm:text-sm sm:leading-6">
          {post.title}
        </span>
        <span className="mt-1 hidden line-clamp-2 text-xs leading-5 text-slate-500 sm:block">
          {post.summary}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
          <PostScoreBadge post={post} size="compact" />
          <span>{metric}</span>
          <span className="max-w-[9rem] truncate">{post.sourceName}</span>
        </span>
      </span>
    </Link>
  );
}

function RankingImageFallback({ post }: { post: Post }) {
  return (
    <span className="flex h-16 w-full flex-col justify-end bg-gradient-to-br from-blue-600 via-violet-600 to-slate-900 p-3 text-white sm:h-[72px]">
      <span className="text-[10px] font-bold opacity-75">{post.type.toUpperCase()}</span>
      <span className="mt-1 line-clamp-2 text-xs font-black leading-4">
        {post.tags[0] ?? "AI圈"}
      </span>
    </span>
  );
}

function getRankingTime(post: Post) {
  const time = new Date(post.collectedAt ?? post.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getRankingImage(post: Post) {
  return getDisplayImageUrl(post.coverImageUrl || post.imageUrls?.[0], post.sourceUrl);
}
