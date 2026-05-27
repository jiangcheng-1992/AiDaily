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
import { PostScoreBadge } from "@/components/post-score-badge";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Card } from "@/components/ui/card";
import { getDisplayImageUrl, isGeneratedPreviewImageUrl } from "@/lib/image-url";
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
  const articlePreviewImage = pickReliableImage(post.coverImageUrl, post.imageUrls?.[0]);
  const displayArticlePreviewImage = getDisplayImageUrl(articlePreviewImage, post.sourceUrl);
  const displayVideoCoverImage = getDisplayImageUrl(post.coverImageUrl, post.sourceUrl);

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/post/${post.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter") router.push(`/post/${post.id}`);
      }}
      className="group cursor-pointer overflow-hidden rounded-[1.6rem] border-white/80 bg-white/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-lift"
    >
      <article className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PostScoreBadge post={post} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <PostTypeBadge type={post.type} />
                {post.featured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    今日精选
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-slate-500">
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
          <span className="hidden rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
            {post.author ?? "AI圈编辑部"}
          </span>
        </div>

        <h2 className="mt-3.5 text-[1.25rem] font-black leading-snug tracking-normal text-slate-950 sm:text-[1.35rem]">
          {post.title}
        </h2>

        {post.type === "video" ? (
          <p className="mt-2.5 line-clamp-3 text-[13px] leading-6 text-slate-600 sm:text-[13.5px]">
            {post.summary}
          </p>
        ) : null}

        {post.type !== "video" && displayArticlePreviewImage ? (
          <ExternalImage
            src={displayArticlePreviewImage}
            alt={post.title}
            loading="lazy"
            wrapperClassName="mt-3 inline-flex max-w-full overflow-hidden rounded-[1.1rem] border border-slate-100 bg-slate-100 sm:max-w-[420px]"
            className="block max-h-[220px] max-w-full object-contain"
          />
        ) : null}

        {post.type === "video" && displayVideoCoverImage ? (
          <div className="relative mt-3 inline-block max-w-full overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-950 shadow-soft sm:max-w-[460px]">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl"
              style={{ backgroundImage: `url(${displayVideoCoverImage})` }}
            />
            <div className="relative">
              <ExternalImage
                src={displayVideoCoverImage}
                alt={post.title}
                className="block max-h-[260px] max-w-full bg-black object-contain"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/72 px-3 py-1.5 text-xs font-bold text-white">
                <Play className="h-3.5 w-3.5 fill-current" />
                观看视频
              </div>
              <div className="absolute bottom-3 right-3 rounded-full bg-black/72 px-3 py-1.5 text-xs font-bold text-white">
                {formatVideoDuration(post.durationMs)}
              </div>
            </div>
          </div>
        ) : null}

        {post.type !== "video" ? (
          <p className="mt-2.5 line-clamp-3 text-[13px] leading-6 text-slate-600 sm:text-[13.5px]">
            {post.summary}
          </p>
        ) : null}

        {post.type === "skill" && post.sourceUrl ? (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            查看 GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        <div className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50/70 p-3">
          <div className="text-[11px] font-black tracking-[0.08em] text-blue-700">
            推荐理由
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-slate-700">
            {post.whyItMatters}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={(event) => {
                event.stopPropagation();
                onTagClick?.(tag);
              }}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              #{tag}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
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

function pickReliableImage(...urls: Array<string | null | undefined>) {
  return urls.find((url) => url && !isGeneratedPreviewImageUrl(url));
}
