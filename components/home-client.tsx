"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { GoogleAdSlot } from "@/components/google-ad-slot";
import { HomeSidebar } from "@/components/home-sidebar";
import { PostCard } from "@/components/post-card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import {
  buildHomeFeedPosts,
  filterPostsByHomeChannel,
  homeChannels,
  type HomeChannelId,
} from "@/lib/feed-view";
import { shouldRenderGoogleAd } from "@/lib/google-ads";
import type { WorkItem } from "@/lib/interesting-works";
import { mockPosts, type Post } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const feedAdSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FEED_SLOT;
const showFeedAd = shouldRenderGoogleAd(feedAdSlot);
const INITIAL_VISIBLE_POST_COUNT = 10;
const LOAD_MORE_POST_COUNT = 8;

export function HomeClient({
  initialPosts = [],
  initialWorks = [],
  initialSkillWorks = [],
}: {
  initialPosts?: Post[];
  initialWorks?: WorkItem[];
  initialSkillWorks?: WorkItem[];
}) {
  const { submissions, getPostStats, toggleLike, toggleSave } = useAiCircleStore();
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<HomeChannelId>("all");
  const [visiblePostCount, setVisiblePostCount] = useState(INITIAL_VISIBLE_POST_COUNT);
  const [liveFeedPosts, setLiveFeedPosts] = useState<Post[]>(initialPosts);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const sourcePosts = useMemo(() => {
    const primaryPosts = liveFeedPosts.length > 0 ? liveFeedPosts : initialPosts;
    const supplementalPosts = submissions.filter((post) => post.type !== "skill");

    return buildHomeFeedPosts(mergeHomePosts([...supplementalPosts, ...primaryPosts]));
  }, [initialPosts, liveFeedPosts, submissions]);
  const dramaFallbackPosts = useMemo(
    () => buildHomeFeedPosts(mockPosts.filter((post) => post.tags.includes("AI短剧"))),
    [],
  );

  const filteredPosts = useMemo(() => {
    const channelPosts = filterPostsByHomeChannel(sourcePosts, selectedChannel);
    const channelPostsWithFallback =
      selectedChannel === "drama"
        ? mergeHomePosts([...channelPosts, ...dramaFallbackPosts])
        : channelPosts;
    const visiblePosts = selectedTag
      ? channelPostsWithFallback.filter((post) => post.tags.includes(selectedTag))
      : channelPostsWithFallback;

    return visiblePosts.length > 0
      ? visiblePosts
      : selectedChannel === "all" && !selectedTag
        ? sourcePosts
        : [];
  }, [dramaFallbackPosts, selectedChannel, selectedTag, sourcePosts]);

  const displayedPosts = filteredPosts.slice(0, visiblePostCount);
  const hasMorePosts = visiblePostCount < filteredPosts.length;

  const handleChannelChange = useCallback((channel: HomeChannelId) => {
    setSelectedChannel(channel);
    setVisiblePostCount(INITIAL_VISIBLE_POST_COUNT);
  }, []);

  const handleTagChange = useCallback((tag: string | null) => {
    setSelectedTag(tag);
    setVisiblePostCount(INITIAL_VISIBLE_POST_COUNT);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLiveFeed() {
      try {
        const response = await fetch("/api/feed", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as {
          posts?: Post[];
          fallbackActive?: boolean;
          persistedPostCount?: number;
        };

        if (!active || data.fallbackActive || data.persistedPostCount === 0) return;
        if (Array.isArray(data.posts) && data.posts.length > 0) {
          setLiveFeedPosts(data.posts);
        }
      } catch {
        // Keep SSR posts on transient client fetch failures.
      }
    }

    void loadLiveFeed();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasMorePosts) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setVisiblePostCount((count) =>
          Math.min(count + LOAD_MORE_POST_COUNT, filteredPosts.length),
        );
      },
      { rootMargin: "480px 0px" },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [filteredPosts.length, hasMorePosts]);

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}/post/${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.summary, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setSharedPostId(post.id);
      window.setTimeout(() => setSharedPostId(null), 1600);
    } catch {
      setSharedPostId(null);
    }
  };

  return (
    <div>
      <section className="mx-auto grid w-full max-w-screen-sm gap-3 px-2.5 pt-2 sm:max-w-3xl sm:px-4 sm:pt-3 lg:max-w-7xl lg:gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <div className="rounded-[1.6rem] border border-slate-100 bg-white/90 p-3 shadow-soft backdrop-blur">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {homeChannels.map((channel) => (
                <button
                  type="button"
                  key={channel.id}
                  onClick={() => handleChannelChange(channel.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition-colors",
                    selectedChannel === channel.id
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                  )}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          {selectedTag ? (
            <div className="flex items-center justify-between rounded-3xl border border-blue-100 bg-white/85 px-4 py-3 shadow-soft backdrop-blur">
              <div className="text-sm font-semibold text-slate-600">
                正在查看
                <span className="mx-1 font-black text-blue-700">#{selectedTag}</span>
                相关动态
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="清除标签筛选"
                onClick={() => handleTagChange(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {displayedPosts.map((post, index) => (
            <div key={post.id} className="space-y-4 sm:space-y-5">
              {showFeedAd && index === 5 ? (
                <div className="rounded-[1.6rem] border border-slate-100 bg-white/95 p-4 shadow-soft">
                  <div className="mb-2 text-[11px] font-bold text-slate-400">广告</div>
                  <GoogleAdSlot slot={feedAdSlot} className="min-h-[120px]" />
                </div>
              ) : null}
              <PostCard
                post={post}
                stats={getPostStats(post)}
                onLike={toggleLike}
                onSave={toggleSave}
                onTagClick={handleTagChange}
                onShare={handleShare}
                shared={sharedPostId === post.id}
              />
            </div>
          ))}

          {filteredPosts.length > 0 ? (
            <div ref={loadMoreRef} className="flex justify-center pb-8 pt-1">
              {hasMorePosts ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisiblePostCount((count) =>
                      Math.min(count + LOAD_MORE_POST_COUNT, filteredPosts.length),
                    )
                  }
                  className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-bold text-slate-500 shadow-soft transition-colors hover:border-blue-200 hover:text-blue-700"
                >
                  继续加载更多
                </button>
              ) : (
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-400">
                  已显示全部，新的内容会自动补充
                </div>
              )}
            </div>
          ) : null}

          {filteredPosts.length === 0 ? (
            <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 text-center shadow-soft">
              <h2 className="text-lg font-black text-slate-950">暂时没有相关动态</h2>
              <p className="mt-2 text-sm text-slate-500">换个标签看看，新的 AI 机会可能藏在别处。</p>
              <button
                type="button"
                onClick={() => {
                  handleTagChange(null);
                  handleChannelChange("all");
                }}
                className="mt-5 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                查看全部
              </button>
            </div>
          ) : null}
        </div>

        <aside className="hidden max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain pr-1 scroll-pb-8 [scrollbar-gutter:stable] [scrollbar-width:thin] lg:sticky lg:top-20 lg:block lg:self-start">
          <HomeSidebar
            posts={sourcePosts}
            works={initialWorks}
            skillWorks={initialSkillWorks}
            onTagClick={handleTagChange}
          />
        </aside>

        <div className="hidden pb-2 sm:block lg:hidden">
          <HomeSidebar
            posts={sourcePosts}
            works={initialWorks}
            skillWorks={initialSkillWorks}
            onTagClick={handleTagChange}
          />
        </div>
      </section>
    </div>
  );
}

function mergeHomePosts(posts: Post[]) {
  const merged = new Map<string, Post>();

  for (const post of posts) {
    const key = buildHomePostIdentity(post);
    if (!merged.has(key)) {
      merged.set(key, post);
    }
  }

  return Array.from(merged.values());
}

function buildHomePostIdentity(post: Post) {
  if (post.sourceUrl) {
    return `${post.type}:${post.sourceUrl.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase()}`;
  }

  return post.id;
}
