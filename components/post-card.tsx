"use client";

import { useRouter } from "next/navigation";
import {
  Bookmark,
  ExternalLink,
  Heart,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";

import { ExternalImage } from "@/components/external-image";
import { InteractionButton } from "@/components/interaction-button";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import { getDisplayImageUrl } from "@/lib/image-url";
import type { Post } from "@/lib/mock-data";
import { cn, formatRelativeTime, formatVideoDuration } from "@/lib/utils";

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
  const articlePreviewImage = post.coverImageUrl ?? post.imageUrls?.[0];
  const displayArticlePreviewImage = getDisplayImageUrl(articlePreviewImage, post.sourceUrl);

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
      <article className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white shadow-soft sm:h-11 sm:w-11">
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
                <time>
                  {post.collectedAt
                    ? `${formatRelativeTime(post.collectedAt)}收录`
                    : formatRelativeTime(post.createdAt)}
                </time>
              </div>
            </div>
          </div>
          <span className="hidden rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 sm:inline-flex">
            {post.author ?? "AI圈编辑部"}
          </span>
        </div>

        <h2 className="mt-4 text-[1.65rem] font-black leading-[1.2] tracking-normal text-slate-950 sm:mt-5 sm:text-2xl">
          {post.title}
        </h2>

        {post.type !== "video" && displayArticlePreviewImage ? (
          <ExternalImage
            src={displayArticlePreviewImage}
            alt={post.title}
            loading="lazy"
            wrapperClassName="mt-4 overflow-hidden rounded-[1.35rem] border border-slate-100 bg-slate-100"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : null}

        {post.type === "video" && post.coverImageUrl ? (
          <div className="relative mx-auto mt-4 max-w-[210px] rounded-[1.5rem] border border-slate-200 bg-slate-950/95 p-2 shadow-soft sm:max-w-[220px]">
            <div
              className="absolute inset-0 rounded-[1.5rem] bg-cover bg-center opacity-25 blur-xl"
              style={{ backgroundImage: `url(${post.coverImageUrl})` }}
            />
            <div className="relative overflow-hidden rounded-[1.15rem]">
              <img
                src={post.coverImageUrl}
                alt={post.title}
                className="aspect-[9/16] w-full bg-black object-contain"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                <Play className="h-3.5 w-3.5 fill-current" />
                观看视频
              </div>
              <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                {formatVideoDuration(post.durationMs)}
              </div>
            </div>
          </div>
        ) : null}

        <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-slate-600 sm:text-[15px]">
          {post.summary}
        </p>

        {post.type === "skill" && post.sourceUrl ? (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            查看 GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        {post.type === "video" && post.sourceUrl ? (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-fuchsia-700"
          >
            去抖音原视频
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
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
