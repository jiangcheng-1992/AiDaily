"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Search } from "lucide-react";

import { PostCard } from "@/components/post-card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { Post } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function SavedClient() {
  const {
    allPosts,
    savedPostIds,
    getPostStats,
    toggleLike,
    toggleSave,
  } = useAiCircleStore();
  const [query, setQuery] = useState("");
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);

  const savedPosts = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    return allPosts
      .filter((post) => savedPostIds.includes(post.id))
      .filter((post) =>
        lowerQuery
          ? [post.title, post.summary, post.sourceName, ...post.tags]
              .join(" ")
              .toLowerCase()
              .includes(lowerQuery)
          : true,
      );
  }, [allPosts, query, savedPostIds]);

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <Bookmark className="h-4 w-4" />
          我的收藏
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          值得回看的 AI 机会
        </h1>
      </div>

      {savedPostIds.length ? (
        <div className="surface-blur mb-5 rounded-3xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索收藏内容..."
              className="pl-11"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        {savedPosts.length ? (
          savedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              stats={getPostStats(post)}
              onLike={toggleLike}
              onSave={toggleSave}
              onShare={handleShare}
              shared={sharedPostId === post.id}
            />
          ))
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/85 p-10 text-center shadow-soft">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
              <Bookmark className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-950">
              你还没有收藏内容，去首页发现 AI 新机会吧。
            </h2>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "gradient" }), "mt-6")}
            >
              去首页发现
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
