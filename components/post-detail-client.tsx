"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Bot,
  Pencil,
  ExternalLink,
  Heart,
  MessageCircle,
  Play,
  SendHorizontal,
  Share2,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
} from "lucide-react";

import { InteractionButton } from "@/components/interaction-button";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import { getPostById, type Comment, type Post } from "@/lib/mock-data";
import {
  cn,
  formatCompactNumber,
  formatRelativeTime,
  formatVideoDuration,
} from "@/lib/utils";

export function PostDetailClient({
  postId,
  initialPost,
  initialComments = [],
}: {
  postId: string;
  initialPost?: Post;
  initialComments?: Comment[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    hydrated,
    allPosts,
    likedCommentIds,
    getPostStats,
    getCommentsForPost,
    toggleLike,
    toggleSave,
    addComment,
    addAiComments,
    addGeneratedComments,
    toggleCommentLike,
    canManageSubmission,
    deleteSubmission,
  } = useAiCircleStore();
  const [commentText, setCommentText] = useState("");
  const [shared, setShared] = useState(false);
  const [aiCommentNotice, setAiCommentNotice] = useState("");
  const [isGeneratingAiComments, setIsGeneratingAiComments] = useState(false);

  const post = useMemo(
    () => getPostById(allPosts, postId) ?? initialPost,
    [allPosts, initialPost, postId],
  );

  if (!post && !hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-soft">
          <div className="h-6 w-1/3 rounded-full bg-slate-100" />
          <div className="mt-6 h-10 w-4/5 rounded-2xl bg-slate-100" />
          <div className="mt-4 h-4 w-full rounded-full bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Card className="rounded-3xl p-10">
          <h1 className="text-2xl font-black text-slate-950">这条内容走丢了</h1>
          <p className="mt-3 text-slate-500">
            可能是本地投稿被清除，或者链接已经失效。
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white"
          >
            回首页继续刷
          </Link>
        </Card>
      </div>
    );
  }

  const stats = getPostStats(post);
  const canManageCurrentSubmission = canManageSubmission(post, user?.id, user?.name);
  const storedComments = getCommentsForPost(post.id);
  const comments = storedComments.length ? storedComments : initialComments;
  const paragraphs = post.content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const normalizedSummary = post.summary.trim();
  const displayParagraphs = paragraphs.filter((paragraph, index) => {
    if (index > 0) return true;

    const normalizedParagraph = paragraph.trim();
    return (
      normalizedParagraph !== normalizedSummary &&
      !normalizedParagraph.startsWith(normalizedSummary.slice(0, 24))
    );
  });
  const videoEmbedUrl =
    post.type === "video" ? post.videoEmbedUrl ?? buildDouyinEmbedUrl(post.sourceUrl) : undefined;

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.summary, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      setShared(false);
    }
  };

  const handleGenerateAiComments = async () => {
    if (isGeneratingAiComments) return;

    setIsGeneratingAiComments(true);

    try {
      const existingRoleIds = comments
        .map((comment) => comment.roleId)
        .filter((roleId): roleId is string => Boolean(roleId));
      const response = await fetch("/api/ai-comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post, existingRoleIds }),
      });

      if (!response.ok) {
        throw new Error("AI comment request failed");
      }

      const data = (await response.json()) as {
        ok: boolean;
        provider: "openai" | "local";
        comments: Comment[];
      };
      const added = addGeneratedComments(post.id, data.comments ?? []);

      setAiCommentNotice(
        added.length
          ? `已通过${data.provider === "openai" ? "正式模型" : "本地角色"}生成 ${added.length} 条 AI 评论`
          : "这篇帖子已经生成过 AI 角色评论",
      );
    } catch {
      const generated = addAiComments(post);
      setAiCommentNotice(
        generated.length
          ? `网络暂不可用，已用本地角色生成 ${generated.length} 条 AI 评论`
          : "这篇帖子已经生成过 AI 角色评论",
      );
    } finally {
      setIsGeneratingAiComments(false);
      window.setTimeout(() => setAiCommentNotice(""), 2600);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-soft transition-colors hover:bg-blue-50 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white/95">
        <article className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <PostTypeBadge type={post.type} />
            {post.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                今日精选
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 text-3xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl">
            {post.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-slate-500">
            <span>{post.sourceName}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <time>
              {post.collectedAt
                ? `${formatRelativeTime(post.collectedAt)}收录`
                : formatRelativeTime(post.createdAt)}
            </time>
            {post.author ? (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{post.author}</span>
              </>
            ) : null}
            {post.type === "skill" && post.sourceUrl ? (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-700 hover:underline"
              >
                查看 GitHub
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {post.type === "video" && post.profileUrl ? (
              <a
                href={post.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-fuchsia-700 hover:underline"
              >
                查看作者主页
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>

          {canManageCurrentSubmission ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/submit?edit=${encodeURIComponent(post.id)}`}
                className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
              >
                <Pencil className="h-4 w-4" />
                编辑投稿
              </Link>
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm("确认删除这条投稿吗？删除后不可恢复。");
                  if (!confirmed) return;
                  const deleted = deleteSubmission(post.id, user?.id, user?.name);
                  if (deleted) {
                    router.push("/me");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <Trash2 className="h-4 w-4" />
                删除投稿
              </button>
            </div>
          ) : null}

          {post.type !== "video" && post.coverImageUrl ? (
            <figure className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-100 shadow-soft">
              <img
                src={post.coverImageUrl}
                alt={post.title}
                className="max-h-[480px] w-full object-cover"
                loading="lazy"
              />
            </figure>
          ) : null}

          {post.type === "video" ? (
            <div className="mx-auto mt-6 max-w-[380px] overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-950 shadow-lift">
              {post.videoUrl ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={post.coverImageUrl}
                  className="aspect-[9/16] w-full bg-black object-contain"
                  src={post.videoUrl}
                />
              ) : videoEmbedUrl ? (
                <iframe
                  title={post.title}
                  src={videoEmbedUrl}
                  loading="lazy"
                  allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="aspect-[9/16] w-full border-0 bg-black"
                />
              ) : post.coverImageUrl ? (
                <div className="relative">
                  <img
                    src={post.coverImageUrl}
                    alt={post.title}
                    className="aspect-[9/16] w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">
                      <Play className="h-4 w-4 fill-current" />
                      视频暂不可站内播放
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-slate-200">
                <div className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <span>{post.videoUrl ? "站内播放" : videoEmbedUrl ? "站内嵌入播放" : "视频预览"}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  <span>{formatVideoDuration(post.durationMs)}</span>
                </div>
                {post.sourceUrl ? (
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-bold text-slate-900 transition-colors hover:bg-fuchsia-100"
                  >
                    去抖音原视频
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-6 rounded-3xl bg-slate-50 p-5 text-base leading-8 text-slate-700">
            {post.summary}
          </p>

          <div className="mt-8 space-y-5 text-[16px] leading-8 text-slate-700">
            {displayParagraphs.map((paragraph, index) => (
              <p key={`${post.id}-p-${index}`}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50/70 p-5">
              <div className="flex items-center gap-2 text-sm font-black text-blue-700">
                <Star className="h-5 w-5" />
                为什么重要
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {post.whyItMatters}
              </p>
            </section>
            <section className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Sparkles className="h-5 w-5 text-violet-600" />
                站长总结
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {post.editorComment}
              </p>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                href={`/?tag=${encodeURIComponent(tag)}`}
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
              >
                #{tag}
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-1">
              <InteractionButton
                icon={Heart}
                label="点赞"
                count={stats.likesCount}
                active={stats.liked}
                onClick={() => toggleLike(post.id)}
              />
              <InteractionButton
                icon={MessageCircle}
                label="评论"
                count={stats.commentsCount}
              />
            </div>
            <div className="flex items-center gap-1">
              <InteractionButton
                icon={Bookmark}
                label="收藏"
                count={stats.savesCount}
                active={stats.saved}
                onClick={() => toggleSave(post.id)}
              />
              <InteractionButton
                icon={Share2}
                label={shared ? "已复制" : "分享"}
                onClick={handleShare}
              />
            </div>
          </div>
        </article>
      </Card>

      <Card id="comments" className="mt-6 rounded-[2rem] bg-white/95 p-5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-950">全部评论</h2>
            <span className="text-lg font-semibold text-slate-400">
              {formatCompactNumber(comments.length)}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={handleGenerateAiComments}
            disabled={isGeneratingAiComments}
          >
            <Bot className="h-4 w-4" />
            {isGeneratingAiComments ? "生成中..." : "AI 角色评论"}
          </Button>
        </div>

        {aiCommentNotice ? (
          <div className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            {aiCommentNotice}
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white">
            探
          </div>
          <div className="min-w-0 flex-1">
            <Textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="分享你的专业见解..."
              className="min-h-24"
            />
            <div className="mt-3 flex justify-end">
              <Button
                variant="gradient"
                onClick={() => {
                  const comment = addComment(post.id, commentText);
                  if (comment) setCommentText("");
                }}
              >
                <SendHorizontal className="h-4 w-4" />
                发布评论
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          {comments.length ? (
            comments.map((comment) => {
              const liked = likedCommentIds.includes(comment.id);

              return (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black",
                      comment.isAi
                        ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                        : comment.avatarText === "探"
                          ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {comment.avatarText ?? comment.author.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                        {comment.author}
                        {comment.isAi ? (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-black text-violet-700">
                            AI 角色
                          </span>
                        ) : null}
                      </span>
                      <time className="text-xs font-medium text-slate-400">
                        {formatRelativeTime(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {comment.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleCommentLike(comment.id)}
                      className={cn(
                        "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-white hover:text-blue-700",
                        liked && "bg-white text-blue-700",
                      )}
                    >
                      <ThumbsUp
                        className={cn("h-3.5 w-3.5", liked && "fill-current")}
                      />
                      {comment.likesCount + (liked ? 1 : 0)}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">
                还没有评论，抢一个 AI 圈前排吧。
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function buildDouyinEmbedUrl(sourceUrl?: string) {
  if (!sourceUrl) return undefined;

  const videoId = sourceUrl.match(/\/video\/(\d+)/)?.[1] ?? sourceUrl.match(/\/share\/video\/(\d+)/)?.[1];
  return videoId ? `https://www.iesdouyin.com/share/video/${videoId}` : undefined;
}
