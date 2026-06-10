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
            onClick={(event) => event.stopPropagation()}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            查看 GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        <div className="mt-4 space-y-2 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50/70 p-3">
          {buildAiCircleInsights(post).map((item) => (
            <div key={item.label}>
              <div className="text-[11px] font-black tracking-[0.08em] text-blue-700">
                {item.label}
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-slate-700">
                {item.text}
              </p>
            </div>
          ))}
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

function buildAiCircleInsights(post: Post) {
  return [
    {
      label: "AI圈原创推荐理由",
      text: post.whyItMatters || `这条内容与 ${post.tags[0] ?? "AI 趋势"} 相关，适合快速判断是否值得继续关注。`,
    },
    {
      label: "适合人群",
      text: inferAudience(post),
    },
    {
      label: "价值分析",
      text: inferValueAnalysis(post),
    },
  ];
}

function inferAudience(post: Post) {
  const text = buildPostText(post);

  if (post.type === "tool" || /(工具|效率|自动化|workflow|mcp|插件|copilot|cursor|代码|开发)/i.test(text)) {
    return "适合 AI 产品经理、开发者、运营同学和正在搭建自动化工作流的团队。";
  }

  if (post.type === "product" || /(发布|上线|产品|平台|订阅|商业化|模型服务)/i.test(text)) {
    return "适合关注 AI 产品机会、竞品动态、商业化路径的创业者和产品团队。";
  }

  if (post.type === "video" || /(视频|创作|sora|镜头|剪辑|多模态|aigc)/i.test(text)) {
    return "适合内容创作者、短视频团队、设计师和想学习 AI 创作案例的读者。";
  }

  if (/(论文|研究|benchmark|评测|训练|推理|安全|对齐|模型能力)/i.test(text)) {
    return "适合研究员、算法工程师、技术负责人和需要跟进模型能力边界的人。";
  }

  return "适合希望快速了解 AI 新闻、工具变化和创作灵感的普通读者。";
}

function inferValueAnalysis(post: Post) {
  const text = buildPostText(post);

  if (/(降本|效率|自动化|工作流|工具|agent|智能体|mcp)/i.test(text)) {
    return "价值在于判断它能否降低重复劳动、提升交付速度，并沉淀为可复用流程。";
  }

  if (/(产品|发布|上线|平台|商业|订阅|生态)/i.test(text)) {
    return "价值在于观察 AI 产品化方向、用户需求变化，以及可借鉴的功能包装方式。";
  }

  if (/(视频|图像|创作|内容|素材|设计|prompt|提示词)/i.test(text)) {
    return "价值在于提炼可复用的创作方法，帮助读者把灵感转化为可执行案例。";
  }

  if (/(论文|研究|评测|benchmark|推理|训练|安全|对齐)/i.test(text)) {
    return "价值在于理解模型能力、限制和技术趋势，为选型或学习路线提供参考。";
  }

  return "价值在于把分散信息整理成可读判断，帮助读者决定是否深入阅读原文。";
}

function buildPostText(post: Post) {
  return `${post.title} ${post.summary} ${post.whyItMatters} ${post.tags.join(" ")}`;
}
