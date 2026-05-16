"use client";

import { useRouter } from "next/navigation";
import { Bookmark, Heart, MessageCircle, Share2, Sparkles } from "lucide-react";

import { InteractionButton } from "@/components/interaction-button";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import type { Post } from "@/lib/mock-data";
import { cn, formatRelativeTime } from "@/lib/utils";

type PostStats = {
  liked: boolean;
  saved: boolean;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
};

export function PostCard({
  post,
  stats,
  onLike,
  onSave,
  onTagClick,
  onShare,
  shared,
}: {
  post: Post;
  stats: PostStats;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onTagClick?: (tag: string) => void;
  onShare?: (post: Post) => void;
  shared?: boolean;
}) {
  const router = useRouter();

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/post/${post.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(`/post/${post.id}`);
      }}
      className="group cursor-pointer overflow-hidden rounded-3xl border-white/80 bg-white/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-lift"
    >
      <article className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white shadow-soft">
              {post.sourceName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PostTypeBadge type={post.type} />
                {post.featured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    今日精选
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                <span>{post.sourceName}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <time>{formatRelativeTime(post.createdAt)}</time>
              </div>
            </div>
          </div>
          <span className="hidden rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 sm:inline-flex">
            {post.author ?? "AI圈编辑部"}
          </span>
        </div>

        <h2 className="mt-5 text-xl font-black leading-snug tracking-normal text-slate-950 sm:text-2xl">
          {post.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-slate-600">
          {post.summary}
        </p>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50/70 p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
            为什么重要
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
            {post.whyItMatters}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={(event) => {
                event.stopPropagation();
                onTagClick?.(tag);
              }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              #{tag}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex min-w-0 items-center gap-1">
            <InteractionButton
              icon={Heart}
              label="点赞"
              count={stats.likesCount}
              active={stats.liked}
              onClick={() => onLike(post.id)}
            />
            <InteractionButton
              icon={MessageCircle}
              label="评论"
              count={stats.commentsCount}
              onClick={() => router.push(`/post/${post.id}#comments`)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <InteractionButton
              icon={Bookmark}
              label="收藏"
              count={stats.savesCount}
              active={stats.saved}
              onClick={() => onSave(post.id)}
            />
            <InteractionButton
              icon={Share2}
              label={shared ? "已复制" : "分享"}
              onClick={() => onShare?.(post)}
            />
          </div>
        </div>
      </article>
      <div
        className={cn(
          "h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 opacity-0 transition-opacity group-hover:opacity-100",
          post.featured && "opacity-100",
        )}
      />
    </Card>
  );
}
