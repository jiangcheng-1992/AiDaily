"use client";

import Link from "next/link";
import {
  Bookmark,
  ChartNoAxesColumnIncreasing,
  Flame,
  MessageCircle,
  Sparkles,
  Trophy,
  Wrench,
} from "lucide-react";

import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { Post } from "@/lib/mock-data";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils";

export function RankingClient() {
  const { allPosts, getPostStats } = useAiCircleStore();

  const withScore = (post: Post) => {
    const stats = getPostStats(post);
    return stats.likesCount + stats.commentsCount * 2 + stats.savesCount;
  };

  const todayHot = [...allPosts]
    .sort(
      (a, b) =>
        withScore(b) - withScore(a) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);
  const weekHot = [...allPosts].sort((a, b) => withScore(b) - withScore(a)).slice(0, 5);
  const productHot = allPosts
    .filter((post) => post.type === "product" || post.type === "tool")
    .sort((a, b) => getPostStats(b).savesCount - getPostStats(a).savesCount)
    .slice(0, 5);
  const skillHot = allPosts
    .filter((post) => post.type === "skill")
    .sort((a, b) => getPostStats(b).savesCount - getPostStats(a).savesCount)
    .slice(0, 5);
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
        <p className="mt-3 max-w-2xl text-base leading-8 text-slate-500">
          用点赞、评论、收藏和编辑精选信号，整理出更值得优先阅读的 AI 动态。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingSection
          title="今日热门"
          icon={Flame}
          posts={todayHot}
          metric={(post) => `${formatCompactNumber(withScore(post))} 热度`}
        />
        <RankingSection
          title="本周热门"
          icon={Trophy}
          posts={weekHot}
          metric={(post) => `${formatCompactNumber(withScore(post))} 综合分`}
        />
        <RankingSection
          title="AI 产品榜"
          icon={Wrench}
          posts={productHot}
          metric={(post) => `${formatCompactNumber(getPostStats(post).savesCount)} 收藏`}
        />
        <RankingSection
          title="最受欢迎技巧"
          icon={Sparkles}
          posts={skillHot}
          metric={(post) => `${formatCompactNumber(getPostStats(post).savesCount)} 收藏`}
        />
        <RankingSection
          title="评论最多内容"
          icon={MessageCircle}
          posts={commentsHot}
          metric={(post) => `${formatCompactNumber(getPostStats(post).commentsCount)} 评论`}
          className="lg:col-span-2"
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
}: {
  title: string;
  icon: typeof Flame;
  posts: Post[];
  metric: (post: Post) => string;
  className?: string;
}) {
  return (
    <Card className={className ? `${className} rounded-[2rem] p-5` : "rounded-[2rem] p-5"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
        </div>
        <Bookmark className="h-5 w-5 text-slate-300" />
      </div>
      <div className="space-y-3">
        {posts.map((post, index) => (
          <Link
            href={`/post/${post.id}`}
            key={post.id}
            className="group grid grid-cols-[42px_1fr] gap-3 rounded-3xl p-2 transition-colors hover:bg-slate-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-violet-600 group-hover:text-white">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <PostTypeBadge type={post.type} className="px-2 py-0.5" />
                <span className="text-xs font-medium text-slate-400">
                  {formatRelativeTime(post.createdAt)}
                </span>
              </span>
              <span className="mt-2 block line-clamp-2 text-sm font-black leading-6 text-slate-900 group-hover:text-blue-700">
                {post.title}
              </span>
              <span className="mt-1 block text-xs font-semibold text-slate-400">
                {metric(post)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
