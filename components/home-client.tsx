"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { GoogleAdSlot } from "@/components/google-ad-slot";
import { HomeSidebar } from "@/components/home-sidebar";
import { PostCard } from "@/components/post-card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { Post } from "@/lib/mock-data";

const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
const feedAdSlot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FEED_SLOT;

function sortPosts(posts: Post[]) {
  return [...posts].sort(
    (a, b) =>
      new Date(b.collectedAt ?? b.createdAt).getTime() -
        new Date(a.collectedAt ?? a.createdAt).getTime() ||
      Number(b.featured) - Number(a.featured),
  );
}

export function HomeClient({ initialPosts = [] }: { initialPosts?: Post[] }) {
  const { allPosts, hydrated, getPostStats, toggleLike, toggleSave } = useAiCircleStore();
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const sourcePosts = useMemo(() => {
    const generatedOrSubmissionPosts = allPosts.filter((post) => post.type !== "skill");
    if (initialPosts.length > 0 && (!hydrated || generatedOrSubmissionPosts.length === 0)) {
      return initialPosts;
    }

    return allPosts;
  }, [allPosts, hydrated, initialPosts]);

  const filteredPosts = useMemo(() => {
    const visiblePosts = selectedTag
      ? sourcePosts.filter(
          (post) => post.type !== "skill" && post.tags.includes(selectedTag),
        )
      : sourcePosts.filter((post) => post.type !== "skill");

    return sortPosts(visiblePosts);
  }, [selectedTag, sourcePosts]);

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
          {selectedTag ? (
            <div className="flex items-center justify-between rounded-3xl border border-blue-100 bg-white/85 px-4 py-3 shadow-soft backdrop-blur">
              <div className="text-sm font-semibold text-slate-600">
                正在查看
                <span className="mx-1 font-black text-blue-700">#{selectedTag}</span>
                相关动态
              </div>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="清除标签筛选"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {filteredPosts.map((post, index) => (
            <div key={post.id} className="space-y-4 sm:space-y-5">
              {adsenseClient && feedAdSlot && index === 5 ? (
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
                onTagClick={setSelectedTag}
                onShare={handleShare}
                shared={sharedPostId === post.id}
              />
            </div>
          ))}

          {filteredPosts.length === 0 ? (
            <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 text-center shadow-soft">
              <h2 className="text-lg font-black text-slate-950">暂时没有相关动态</h2>
              <p className="mt-2 text-sm text-slate-500">换个标签看看，新的 AI 机会可能藏在别处。</p>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="mt-5 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                查看全部
              </button>
            </div>
          ) : null}
        </div>

        <aside className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] lg:block">
          <div className="sticky top-0">
            <HomeSidebar posts={sourcePosts} onTagClick={setSelectedTag} />
          </div>
        </aside>

        <div className="hidden pb-2 sm:block lg:hidden">
          <HomeSidebar posts={sourcePosts} onTagClick={setSelectedTag} />
        </div>
      </section>
    </div>
  );
}
