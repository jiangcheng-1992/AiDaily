"use client";

import { useMemo, useState } from "react";

import { PostCard } from "@/components/post-card";
import { Card } from "@/components/ui/card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { Post } from "@/lib/mock-data";

export function SkillsClient({ initialPosts = [] }: { initialPosts?: Post[] }) {
  const { allPosts, hydrated, getPostStats, toggleLike, toggleSave } =
    useAiCircleStore();
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);

  const skillPosts = useMemo(
    () =>
      dedupePosts([...allPosts, ...initialPosts])
        .filter((post) => post.type === "skill")
        .sort(
          (a, b) =>
            b.likesCount + b.savesCount - (a.likesCount + a.savesCount) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [allPosts, initialPosts],
  );

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
    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-[2rem] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-soft">
        <h1 className="text-3xl font-black tracking-normal">热门 Skill</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
          这里会持续抓取 GitHub 爆款热门和近期增速快的 AI Skill，每条都会标出适用场景、怎么用、GitHub 链接和真实热度指标。
        </p>
      </div>

      <div className="space-y-5">
        {!hydrated ? (
          <Card className="rounded-3xl p-6">
            <div className="h-6 w-1/3 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-5 h-10 w-4/5 animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100" />
          </Card>
        ) : null}

        {skillPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            stats={getPostStats(post)}
            onLike={toggleLike}
            onSave={toggleSave}
            onShare={handleShare}
            shared={sharedPostId === post.id}
          />
        ))}

        {hydrated && skillPosts.length === 0 ? (
          <Card className="rounded-3xl p-8 text-center">
            <h2 className="text-lg font-black text-slate-950">暂时没有 Skill 内容</h2>
            <p className="mt-2 text-sm text-slate-500">
              等下一次 GitHub 抓取完成后，这里会集中展示热门 AI Skill。
            </p>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function dedupePosts(posts: Post[]) {
  const seen = new Set<string>();

  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}
