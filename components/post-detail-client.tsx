"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Bot,
  Pencil,
  ExternalLink,
  Heart,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pause,
  Play,
  SendHorizontal,
  Share2,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";

import { ExternalImage } from "@/components/external-image";
import { GoogleAdSlot } from "@/components/google-ad-slot";
import { InteractionButton } from "@/components/interaction-button";
import { PostScoreBadge } from "@/components/post-score-badge";
import { PostTypeBadge } from "@/components/post-type-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import { getDisplayImageUrl } from "@/lib/image-url";
import { shouldRenderGoogleAd } from "@/lib/google-ads";
import { getPostById, type Comment, type Post } from "@/lib/mock-data";
import {
  cn,
  formatCompactNumber,
  formatRelativeTime,
  formatVideoDuration,
} from "@/lib/utils";

const DEFAULT_DETAIL_AD_SLOT = "4648080221";
const detailAdSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_DETAIL_SLOT || DEFAULT_DETAIL_AD_SLOT;
const showDetailAd = shouldRenderGoogleAd(detailAdSlot);

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
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoLoadProgress, setVideoLoadProgress] = useState(0);
  const [videoSlow, setVideoSlow] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoNeedsManualPlay, setVideoNeedsManualPlay] = useState(false);
  const [videoPlaybackMode, setVideoPlaybackMode] = useState<"direct" | "embed">("direct");
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | undefined>();
  const [resolvedVideoEmbedUrl, setResolvedVideoEmbedUrl] = useState<string | undefined>();
  const [videoSourceLimited, setVideoSourceLimited] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const loadProgressTimerRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const playbackRequestStartedAtRef = useRef<number | null>(null);
  const lastLoggedProgressBucketRef = useRef<number>(-1);

  const post = useMemo(
    () => getPostById(allPosts, postId) ?? initialPost,
    [allPosts, initialPost, postId],
  );
  const isDouyinVideoPost =
    post?.type === "video" &&
    isLikelyDouyinVideoPost(post.sourceId, post.sourceUrl, post.profileUrl);
  const isBilibiliVideoPost =
    post?.type === "video" &&
    isLikelyBilibiliVideoPost(post.sourceId, post.sourceUrl, post.profileUrl);
  const videoEmbedUrl =
    post?.type === "video" ? post.videoEmbedUrl ?? buildVideoEmbedUrl(post.sourceUrl) : undefined;
  const activeVideoUrl = isDouyinVideoPost
    ? resolvedVideoUrl
    : isBilibiliVideoPost
      ? undefined
      : resolvedVideoUrl ?? post?.videoUrl;
  const activeVideoEmbedUrl = isDouyinVideoPost ? undefined : resolvedVideoEmbedUrl ?? videoEmbedUrl;
  const hasPlayableVideo =
    post?.type === "video" &&
    (isDouyinVideoPost
      ? Boolean(post.sourceUrl || post.videoUrl || videoEmbedUrl)
      : Boolean(activeVideoUrl || activeVideoEmbedUrl));
  const preferEmbedPlayback =
    post?.type === "video" &&
    !isDouyinVideoPost &&
    (isBilibiliVideoPost || !post.videoUrl) &&
    Boolean(videoEmbedUrl) &&
    Boolean(videoEmbedUrl);
  const isEmbedPlaybackActive =
    Boolean(videoStarted && activeVideoEmbedUrl && videoPlaybackMode === "embed");
  const shouldUseEmbedLayout =
    post?.type === "video" &&
    !isDouyinVideoPost &&
    (isBilibiliVideoPost || preferEmbedPlayback || Boolean(activeVideoEmbedUrl) || isEmbedPlaybackActive);
  const articleImageUrls = useMemo(() => {
    if (!post || post.type === "video") return [];

    const seen = new Set<string>();
    return [post.coverImageUrl, ...(post.imageUrls ?? [])].filter((url): url is string => {
      if (!url) return false;
      const normalized = url.replace(/^http:\/\//i, "https://");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [post]);
  const articleBlocks = useMemo(() => {
    if (!post || post.type === "video") return [];

    if (post.contentBlocks?.length) {
      const seenImages = new Set<string>();

      return post.contentBlocks.filter((block) => {
        if (block.type !== "image") return Boolean(block.text?.trim());
        const normalized = block.url.replace(/^http:\/\//i, "https://");
        if (seenImages.has(normalized)) return false;
        seenImages.add(normalized);
        return true;
      });
    }

    return [];
  }, [post]);
  const hasInlineArticleBlocks = articleBlocks.length > 0;
  const originalSourceLabel =
    post?.type === "video"
      ? "查看原视频"
      : post?.type === "skill"
        ? "查看 GitHub 原链接"
        : "查看原网站";
  const logVideoEvent = (
    level: "info" | "warn" | "error",
    event: string,
    data?: Record<string, unknown>,
  ) => {
    const video = videoElementRef.current;
    const payload = {
      postId: post?.id ?? null,
      sourceId: post?.sourceId ?? null,
      sourceUrl: post?.sourceUrl ?? null,
      playbackMode: videoPlaybackMode,
      isDouyinVideoPost,
      videoStarted,
      videoLoading,
      videoReady,
      videoSlow,
      videoFailed,
      videoNeedsManualPlay,
      videoSourceLimited,
      videoLoadProgress,
      activeVideoUrl: activeVideoUrl ?? null,
      activeVideoEmbedUrl: activeVideoEmbedUrl ?? null,
      readyState: video?.readyState ?? null,
      networkState: video?.networkState ?? null,
      currentTime: video?.currentTime ?? null,
      duration: Number.isFinite(video?.duration) ? video?.duration : null,
      currentSrc: video?.currentSrc ?? null,
      elapsedMs:
        playbackRequestStartedAtRef.current !== null
          ? Date.now() - playbackRequestStartedAtRef.current
          : null,
      ...data,
    };

    if (level === "warn") {
      console.warn(`[video] ${event}`, payload);
      return;
    }

    if (level === "error") {
      console.error(`[video] ${event}`, payload);
      return;
    }

    console.info(`[video] ${event}`, payload);
  };

  useEffect(() => {
    if (!post) return;

    const resetTimer = window.setTimeout(() => {
      setVideoStarted(false);
      setVideoLoading(false);
      setVideoReady(false);
      setVideoLoadProgress(0);
      setVideoSlow(false);
      setVideoFailed(false);
      setVideoNeedsManualPlay(false);
      setResolvedVideoUrl(undefined);
      setResolvedVideoEmbedUrl(undefined);
      setVideoSourceLimited(false);
      setVideoCurrentTime(0);
      setVideoDuration(0);
      setVideoPlaying(false);
      setVideoExpanded(false);
      setVideoPlaybackMode(preferEmbedPlayback ? "embed" : "direct");
      playbackRequestStartedAtRef.current = null;
      lastLoggedProgressBucketRef.current = -1;
    }, 0);
    console.info("[video] reset state for post", {
      postId: post.id,
      sourceId: post.sourceId ?? null,
      sourceUrl: post.sourceUrl ?? null,
      type: post.type,
      isDouyinVideoPost,
      isBilibiliVideoPost,
      preferEmbedPlayback,
      hasStoredVideoUrl: Boolean(post.videoUrl),
      hasVideoEmbedUrl: Boolean(videoEmbedUrl),
    });
    return () => window.clearTimeout(resetTimer);
  }, [isBilibiliVideoPost, isDouyinVideoPost, post, preferEmbedPlayback, videoEmbedUrl]);

  useEffect(() => {
    if (!videoLoading) {
      if (loadProgressTimerRef.current !== null) {
        window.clearInterval(loadProgressTimerRef.current);
        loadProgressTimerRef.current = null;
      }
      return;
    }

    loadProgressTimerRef.current = window.setInterval(() => {
      setVideoLoadProgress((current) => {
        if (current >= 92) return current;
        return Math.min(current + (current < 36 ? 14 : 7), 92);
      });
    }, 180);

    return () => {
      if (loadProgressTimerRef.current !== null) {
        window.clearInterval(loadProgressTimerRef.current);
        loadProgressTimerRef.current = null;
      }
    };
  }, [videoLoading]);

  useEffect(() => {
    if (!videoLoading || videoReady) return;

    const slowThresholdMs = videoPlaybackMode === "embed" ? 7000 : 3200;
    const slowTimer = window.setTimeout(() => {
      setVideoSlow(true);
      setVideoLoadProgress((current) => Math.max(current, 92));
      logVideoEvent("warn", "playback became slow", {
        slowThresholdMs,
      });
    }, slowThresholdMs);

    return () => window.clearTimeout(slowTimer);
  }, [videoLoading, videoPlaybackMode, videoReady]);

  useEffect(() => {
    if (!videoStarted || videoPlaybackMode !== "direct" || !activeVideoUrl) return;

    const timer = window.setTimeout(() => {
      videoElementRef.current?.load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeVideoUrl, videoPlaybackMode, videoStarted]);

  useEffect(() => {
    if (!videoStarted || videoPlaybackMode !== "embed" || !activeVideoEmbedUrl) return;

    const fallbackTimer = window.setTimeout(() => {
      logVideoEvent("warn", "embed player load timeout, hiding loading indicator");
      setVideoReady(true);
      setVideoLoading(false);
      setVideoSlow(false);
      setVideoLoadProgress(100);
    }, 5000);

    return () => window.clearTimeout(fallbackTimer);
  }, [activeVideoEmbedUrl, videoPlaybackMode, videoStarted]);

  useEffect(() => {
    if (!videoExpanded) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [videoExpanded]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenDocument = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      if (!fullscreenDocument.fullscreenElement && !fullscreenDocument.webkitFullscreenElement) {
        setVideoExpanded(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

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
        provider: "minimax" | "unavailable";
        comments: Comment[];
        error?: string;
        skipped?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "AI comment request failed");
      }

      const added = addGeneratedComments(post.id, data.comments ?? []);

      setAiCommentNotice(
        added.length
          ? `已通过${data.provider === "minimax" ? "MiniMax" : "AI 服务"}生成 ${added.length} 条 AI 评论`
          : "这篇帖子已经生成过 AI 角色评论",
      );
    } catch (error) {
      setAiCommentNotice(
        error instanceof Error ? error.message : "AI 评论生成失败，请稍后重试",
      );
    } finally {
      setIsGeneratingAiComments(false);
      window.setTimeout(() => setAiCommentNotice(""), 2600);
    }
  };

  const startVideoPlayback = async () => {
    playbackRequestStartedAtRef.current = Date.now();
    lastLoggedProgressBucketRef.current = -1;
    setVideoStarted(true);
    setVideoReady(false);
    setVideoLoading(true);
    setVideoLoadProgress(videoPlaybackMode === "embed" ? 16 : 8);
    setVideoSlow(false);
    setVideoFailed(false);
    setVideoNeedsManualPlay(false);
    setVideoSourceLimited(false);
    console.info("[video] user requested playback", {
      postId: post.id,
      sourceId: post.sourceId ?? null,
      sourceUrl: post.sourceUrl ?? null,
      isDouyinVideoPost,
      hasStoredVideoUrl: Boolean(post.videoUrl),
      hasVideoEmbedUrl: Boolean(videoEmbedUrl),
    });

    if (isDouyinVideoPost && post.sourceUrl) {
      try {
        console.info("[video] requesting fresh direct url from server", {
          postId: post.id,
          sourceId: post.sourceId ?? null,
          sourceUrl: post.sourceUrl,
        });
        const response = await fetch("/api/video-source", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId: post.sourceId,
            sourceUrl: post.sourceUrl,
          }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          videoUrl?: string | null;
          videoEmbedUrl?: string | null;
          coverImageUrl?: string | null;
        };

        if (response.ok && data.videoUrl) {
          logVideoEvent("info", "resolved fresh douyin direct url", {
            hasEmbedUrl: Boolean(data.videoEmbedUrl),
            directVideoAvailable: true,
          });
          setResolvedVideoUrl(data.videoUrl);
          setResolvedVideoEmbedUrl(undefined);
          setVideoPlaybackMode("direct");
          setVideoLoadProgress(28);
          return;
        }

        logVideoEvent("warn", "no fresh douyin direct url, fallback to source page", {
          responseOk: response.ok,
          videoEmbedUrl: data.videoEmbedUrl ?? null,
          error: !response.ok ? "refresh-api-non-200" : null,
        });
        setResolvedVideoUrl(undefined);
        setResolvedVideoEmbedUrl(undefined);
        setVideoSourceLimited(true);
        setVideoLoading(false);
        setVideoReady(false);
        setVideoLoadProgress(100);
        return;
      } catch (error) {
        logVideoEvent("error", "refresh douyin direct url failed", {
          error,
        });
        setResolvedVideoUrl(undefined);
        setResolvedVideoEmbedUrl(undefined);
        setVideoSourceLimited(true);
        setVideoLoading(false);
        setVideoReady(false);
        setVideoLoadProgress(100);
        return;
      }
    }

    if (videoPlaybackMode !== "direct") {
      return;
    }
  };

  const markVideoReady = () => {
    logVideoEvent("info", "video marked ready");
    setVideoReady(true);
    setVideoLoading(false);
    setVideoLoadProgress(100);
    setVideoSlow(false);
    setVideoNeedsManualPlay(false);
  };

  const markVideoPlaying = () => {
    updateVideoTimeline();
    setVideoPlaying(true);
    markVideoReady();
  };

  const markVideoFailed = () => {
    if (videoPlaybackMode === "direct" && videoEmbedUrl) {
      logVideoEvent("warn", "direct playback failed", {
        videoEmbedUrl,
        mediaErrorCode: videoElementRef.current?.error?.code ?? null,
        mediaErrorMessage: videoElementRef.current?.error?.message ?? null,
      });
      if (isDouyinVideoPost) {
        setResolvedVideoUrl(undefined);
        setResolvedVideoEmbedUrl(undefined);
        setVideoSourceLimited(true);
        setVideoLoading(false);
        setVideoReady(false);
        setVideoLoadProgress(100);
        return;
      }

      setVideoPlaybackMode("embed");
      setVideoFailed(false);
      setVideoSlow(false);
      setVideoLoading(true);
      setVideoLoadProgress(24);
      return;
    }

    logVideoEvent("error", "playback failed", {
      readyState: videoElementRef.current?.readyState ?? null,
      networkState: videoElementRef.current?.networkState ?? null,
      mediaErrorCode: videoElementRef.current?.error?.code ?? null,
      mediaErrorMessage: videoElementRef.current?.error?.message ?? null,
      currentSrc: videoElementRef.current?.currentSrc ?? null,
    });
    setVideoFailed(true);
    setVideoSlow(true);
    setVideoLoading(false);
    setVideoLoadProgress(100);
  };

  const handleVideoBuffering = () => {
    if (!videoReady) return;
    logVideoEvent("warn", "video entered buffering");
    setVideoLoading(true);
    setVideoLoadProgress(72);
  };

  const updateVideoBufferedProgress = () => {
    const video = videoElementRef.current;
    if (!video) return;

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || video.buffered.length === 0) {
      setVideoLoadProgress((current) => Math.max(current, 46));
      return;
    }

    let bufferedEnd = 0;
    for (let index = 0; index < video.buffered.length; index += 1) {
      bufferedEnd = Math.max(bufferedEnd, video.buffered.end(index));
    }

    const bufferedPercent = Math.min(98, Math.round((bufferedEnd / duration) * 100));
    const progressBucket = Math.floor(bufferedPercent / 10);
    if (progressBucket > lastLoggedProgressBucketRef.current) {
      lastLoggedProgressBucketRef.current = progressBucket;
      logVideoEvent("info", "buffered progress updated", {
        bufferedPercent,
        bufferedEnd,
      });
    }
    setVideoLoadProgress((current) => Math.max(current, bufferedPercent));
  };

  const updateVideoTimeline = () => {
    const video = videoElementRef.current;
    if (!video) return;

    setVideoCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
    if (video.currentTime > 0 && !video.paused) {
      setVideoReady(true);
      setVideoLoading(false);
      setVideoSlow(false);
    }
  };

  const toggleVideoPlayback = async () => {
    const video = videoElementRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setVideoPlaying(true);
        markVideoReady();
        return;
      }

      video.pause();
      setVideoPlaying(false);
    } catch (error) {
      logVideoEvent("warn", "custom play toggle failed", { error });
      setVideoNeedsManualPlay(true);
    }
  };

  const seekVideo = (value: string) => {
    const video = videoElementRef.current;
    const nextTime = Number(value);
    if (!video || !Number.isFinite(nextTime)) return;

    video.currentTime = nextTime;
    setVideoCurrentTime(nextTime);
  };

  const toggleVideoExpanded = async () => {
    const fullscreenDocument = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    if (videoExpanded) {
      setVideoExpanded(false);
      if (fullscreenDocument.fullscreenElement && fullscreenDocument.exitFullscreen) {
        await fullscreenDocument.exitFullscreen().catch((error) => {
          logVideoEvent("warn", "exit native fullscreen failed", { error });
        });
      } else if (fullscreenDocument.webkitExitFullscreen) {
        await Promise.resolve(fullscreenDocument.webkitExitFullscreen()).catch((error) => {
          logVideoEvent("warn", "exit native fullscreen failed", { error });
        });
      }
      return;
    }

    setVideoExpanded(true);
    logVideoEvent("info", "expanded video viewport");
    const fullscreenTarget = videoFrameRef.current as
      | (HTMLDivElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        })
      | null;
    const requestFullscreen =
      fullscreenTarget?.requestFullscreen ?? fullscreenTarget?.webkitRequestFullscreen;

    if (fullscreenTarget && requestFullscreen) {
      await Promise.resolve(requestFullscreen.call(fullscreenTarget)).catch((error) => {
        logVideoEvent("warn", "native fullscreen failed, keeping custom overlay", { error });
      });
    }
  };

  const startBufferedVideo = async () => {
    const video = videoElementRef.current;
    if (!video || videoFailed) return;

    updateVideoBufferedProgress();

    if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      logVideoEvent("info", "video not ready for autoplay yet", {
        requiredReadyState: HTMLMediaElement.HAVE_FUTURE_DATA,
      });
      return;
    }

    try {
      setVideoNeedsManualPlay(false);
      await video.play();
      logVideoEvent("info", "video play() resolved");
      markVideoReady();
    } catch (error) {
      logVideoEvent("warn", "autoplay after buffering failed", {
        readyState: video.readyState,
        networkState: video.networkState,
        error,
      });
      setVideoLoading(false);
      setVideoNeedsManualPlay(true);
      setVideoLoadProgress((current) => Math.max(current, 96));
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
            <PostScoreBadge post={post} />
            <PostTypeBadge type={post.type} />
            {post.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                今日精选
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-2xl font-black leading-snug tracking-normal text-slate-950 sm:text-3xl">
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
            {post.type === "video" && post.profileUrl ? (
              <a
                href={post.profileUrl}
                className="inline-flex items-center gap-1 text-fuchsia-700 hover:underline"
              >
                查看作者主页
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>

          {post.sourceUrl ? (
            <div className="mt-5">
              <a
                href={post.sourceUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-soft transition-colors hover:bg-blue-700"
              >
                {originalSourceLabel}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}

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

          {post.type !== "video" && articleImageUrls.length && !hasInlineArticleBlocks ? (
            <div className="mt-6 space-y-4">
              {articleImageUrls.map((imageUrl, index) => (
                <ExternalImage
                  key={`${post.id}-image-${index}`}
                  src={getDisplayImageUrl(imageUrl, post.sourceUrl)}
                  alt={`${post.title} 配图 ${index + 1}`}
                  wrapperAs="figure"
                  wrapperClassName="overflow-hidden rounded-[1.4rem] border border-slate-100 bg-slate-100 shadow-soft"
                  className="max-h-[520px] w-full object-contain"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              ))}
            </div>
          ) : null}

          {post.type === "video" ? (
            <div
              className={cn(
                "mx-auto mt-6 w-full overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-950 shadow-lift",
                shouldUseEmbedLayout ? "max-w-3xl" : "max-w-[360px] sm:max-w-[420px]",
              )}
            >
              <div
                ref={videoFrameRef}
                className={cn(
                  "relative bg-black",
                  videoExpanded &&
                    "fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center rounded-none",
                )}
              >
                {videoStarted && videoPlaybackMode === "direct" && activeVideoUrl ? (
                  <>
                    <video
                      ref={videoElementRef}
                      src={activeVideoUrl}
                      playsInline
                      preload="metadata"
                      poster={post.coverImageUrl}
                      onCanPlay={() => {
                        updateVideoTimeline();
                        markVideoReady();
                      }}
                      onLoadedData={markVideoReady}
                      onLoadedMetadata={updateVideoTimeline}
                      onTimeUpdate={updateVideoTimeline}
                      onPlay={markVideoPlaying}
                      onPlaying={markVideoPlaying}
                      onPause={() => setVideoPlaying(false)}
                      onEnded={() => setVideoPlaying(false)}
                      onWaiting={handleVideoBuffering}
                      onProgress={updateVideoBufferedProgress}
                      onError={markVideoFailed}
                      className={cn(
                        "bg-black object-contain",
                        videoExpanded ? "h-[100dvh] w-screen max-w-none" : "aspect-[9/16] w-full",
                      )}
                    />
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pt-12 text-white",
                        videoExpanded ? "pb-[max(12px,env(safe-area-inset-bottom))]" : "pb-3",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleVideoPlayback}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-soft"
                          aria-label={videoPlaying ? "暂停视频" : "播放视频"}
                        >
                          {videoPlaying ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, Math.floor(videoDuration))}
                          step={0.1}
                          value={Math.min(videoCurrentTime, videoDuration || videoCurrentTime)}
                          onChange={(event) => seekVideo(event.currentTarget.value)}
                          disabled={!videoDuration}
                          aria-label="视频进度"
                          className="h-1.5 min-w-0 flex-1 accent-fuchsia-400"
                        />
                        <span className="min-w-[72px] text-right text-[11px] font-bold text-white/80">
                          {formatVideoDuration(videoCurrentTime * 1000)} /{" "}
                          {formatVideoDuration(videoDuration * 1000)}
                        </span>
                        <button
                          type="button"
                          onClick={toggleVideoExpanded}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20"
                          aria-label={videoExpanded ? "退出全屏" : "全屏播放"}
                        >
                          {videoExpanded ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : videoStarted && activeVideoEmbedUrl ? (
                  <iframe
                    src={activeVideoEmbedUrl}
                    title={post.title}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    loading="lazy"
                    onLoad={markVideoReady}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                    referrerPolicy="no-referrer-when-downgrade"
                    className={cn(
                      "border-0 bg-black",
                      videoExpanded ? "h-[100dvh] w-screen max-w-none" : "aspect-video w-full",
                    )}
                  />
                ) : (
                  <>
                    {post.coverImageUrl ? (
                      <>
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl"
                          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
                        />
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className={cn(
                            "relative w-full object-contain",
                            shouldUseEmbedLayout ? "aspect-video" : "aspect-[9/16]",
                          )}
                        />
                      </>
                    ) : (
                      <div
                        className={cn(
                          "w-full bg-black",
                          shouldUseEmbedLayout ? "aspect-video" : "aspect-[9/16]",
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "absolute flex",
                        shouldUseEmbedLayout
                          ? "inset-0 items-center justify-center bg-black/10"
                          : "inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pb-6 pt-20",
                      )}
                    >
                      <button
                        type="button"
                        onClick={startVideoPlayback}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 bg-white text-sm font-black text-slate-950 shadow-soft transition-colors hover:bg-fuchsia-100",
                          shouldUseEmbedLayout
                            ? "h-16 w-16 rounded-full p-0 sm:h-20 sm:w-20"
                            : "mx-auto w-full rounded-full px-4 py-3",
                        )}
                        aria-label="App 内播放"
                      >
                        {shouldUseEmbedLayout ? null : "App 内播放"}
                        <Play
                          className={cn(
                            "fill-current",
                            shouldUseEmbedLayout ? "h-7 w-7 translate-x-0.5" : "h-4 w-4",
                          )}
                        />
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2 bg-slate-950 px-4 py-3 text-white">
                {videoStarted && videoPlaybackMode === "direct" && activeVideoUrl && !videoExpanded ? (
                  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleVideoPlayback}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-soft"
                        aria-label={videoPlaying ? "暂停视频" : "播放视频"}
                      >
                        {videoPlaying ? (
                          <Pause className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 fill-current" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, Math.floor(videoDuration))}
                        step={0.1}
                        value={Math.min(videoCurrentTime, videoDuration || videoCurrentTime)}
                        onChange={(event) => seekVideo(event.currentTarget.value)}
                        disabled={!videoDuration}
                        aria-label="视频播放进度"
                        className="h-1.5 min-w-0 flex-1 accent-fuchsia-400"
                      />
                      <button
                        type="button"
                        onClick={toggleVideoExpanded}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20"
                        aria-label="全屏播放"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-white/65">
                      <span>播放进度</span>
                      <span>
                        {formatVideoDuration(videoCurrentTime * 1000)} /{" "}
                        {formatVideoDuration(videoDuration * 1000)}
                      </span>
                    </div>
                  </div>
                ) : null}
                {videoLoading &&
                !videoReady &&
                !(videoStarted && videoPlaybackMode === "direct" && activeVideoUrl) ? (
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-fuchsia-400 transition-all"
                        style={{ width: `${videoLoadProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-white/70">
                      {videoSlow ? "视频加载较慢，正在继续尝试..." : "正在加载视频..."}
                    </p>
                  </div>
                ) : null}
                {videoNeedsManualPlay ? (
                  <p className="text-xs font-semibold text-white/70">
                    浏览器阻止了自动播放，请点击播放器中的播放按钮。
                  </p>
                ) : null}
                {videoSourceLimited ? (
                  <p className="text-xs font-semibold text-amber-200">
                    原平台限制了直接播放，建议稍后重试或打开原视频页面。
                  </p>
                ) : null}
                {videoFailed ? (
                  <p className="text-xs font-semibold text-rose-200">
                    当前视频暂时无法在 App 内播放。
                  </p>
                ) : null}
                {post.sourceUrl && !isEmbedPlaybackActive ? (
                  <a
                    href={post.sourceUrl}
                    className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
                  >
                    查看原视频页面
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-6 rounded-3xl bg-slate-50 p-5 text-base leading-8 text-slate-700">
            {post.summary}
          </p>

          {hasInlineArticleBlocks ? (
            <div className="mt-8 space-y-5 text-[16px] leading-8 text-slate-700">
              {articleBlocks.map((block, index) =>
                block.type === "paragraph" ? (
                  <p key={`${post.id}-p-${index}`}>{block.text}</p>
                ) : (
                  <ExternalImage
                    key={`${post.id}-image-${index}`}
                    src={getDisplayImageUrl(block.url, post.sourceUrl)}
                    alt={block.alt || `${post.title} 配图 ${index + 1}`}
                    wrapperAs="figure"
                    wrapperClassName="overflow-hidden rounded-[1.4rem] border border-slate-100 bg-slate-100 shadow-soft"
                    className="max-h-[520px] w-full object-contain"
                    loading={index <= 1 ? "eager" : "lazy"}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-5 text-[16px] leading-8 text-slate-700">
              {displayParagraphs.map((paragraph, index) => (
                <p key={`${post.id}-p-${index}`}>{paragraph}</p>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-blue-700">
                <Sparkles className="h-4 w-4" />
                推荐理由
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                {post.whyItMatters}
              </p>
            </section>
            <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <Sparkles className="h-5 w-5 text-violet-600" />
                站长总结
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
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

      {showDetailAd ? (
        <Card className="mt-6 rounded-[2rem] border-white/80 bg-white/95 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">广告</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              Google AdSense
            </span>
          </div>
          <div className="h-[72px] max-h-[72px] overflow-hidden rounded-[1.2rem] border border-slate-100 bg-slate-50/70 sm:h-[88px] sm:max-h-[88px]">
            <GoogleAdSlot slot={detailAdSlot} className="h-full w-full" />
          </div>
        </Card>
      ) : null}

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
  return videoId ? `https://m.douyin.com/share/video/${videoId}` : undefined;
}

function buildVideoEmbedUrl(sourceUrl?: string) {
  if (!sourceUrl) return undefined;

  const douyinUrl = buildDouyinEmbedUrl(sourceUrl);
  if (douyinUrl) return douyinUrl;

  const youtubeId =
    sourceUrl.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1] ??
    sourceUrl.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    sourceUrl.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/)?.[1] ??
    sourceUrl.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/)?.[1];
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;

  const vimeoId = sourceUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  const bilibiliBvid =
    sourceUrl.match(/\/video\/(BV[A-Za-z0-9]+)/)?.[1] ??
    sourceUrl.match(/[?&]bvid=(BV[A-Za-z0-9]+)/)?.[1];
  if (bilibiliBvid) {
    return buildBilibiliEmbedUrl("bvid", bilibiliBvid);
  }

  const bilibiliAid = sourceUrl.match(/\/video\/av(\d+)/i)?.[1] ?? sourceUrl.match(/[?&]aid=(\d+)/)?.[1];
  if (bilibiliAid) {
    return buildBilibiliEmbedUrl("aid", bilibiliAid);
  }

  return undefined;
}

function buildBilibiliEmbedUrl(idType: "aid" | "bvid", id: string) {
  const url = new URL("https://player.bilibili.com/player.html");
  url.searchParams.set(idType, id);
  url.searchParams.set("autoplay", "0");
  url.searchParams.set("danmaku", "0");
  url.searchParams.set("high_quality", "1");
  url.searchParams.set("as_wide", "1");
  url.searchParams.set("hideCoverInfo", "1");
  return url.toString();
}

function isLikelyDouyinVideoPost(sourceId?: string, sourceUrl?: string, profileUrl?: string) {
  return Boolean(
    sourceId?.startsWith("douyin-") ||
      sourceUrl?.includes("douyin.com") ||
      sourceUrl?.includes("iesdouyin.com") ||
      profileUrl?.includes("douyin.com"),
  );
}

function isLikelyBilibiliVideoPost(sourceId?: string, sourceUrl?: string, profileUrl?: string) {
  return Boolean(
    sourceId?.includes("bilibili") ||
      sourceUrl?.includes("bilibili.com") ||
      sourceUrl?.includes("b23.tv") ||
      profileUrl?.includes("bilibili.com"),
  );
}
