"use client";

import { useMemo, useState } from "react";
import { Bot, CalendarDays, CheckCircle2, Layers3, Sparkles } from "lucide-react";

import { HomeSidebar } from "@/components/home-sidebar";
import { PostCard } from "@/components/post-card";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { Post } from "@/lib/mock-data";

export function HomeClient() {
  const { allPosts, getPostStats, toggleLike, toggleSave } = useAiCircleStore();
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    return [...allPosts].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [allPosts]);

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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 ai-grid opacity-80" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-8 pt-10 sm:px-6 md:pb-10 md:pt-16 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-sm font-bold text-blue-700 shadow-soft backdrop-blur">
              <Sparkles className="h-4 w-4" />
              AI 创作者和独立开发者的每日信息流
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              每天 5 分钟，
              <span className="brand-gradient">刷完 AI 圈新动态</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              聚合每日 AI 新闻、大佬观点、实用技巧、热门产品和创作者案例。像刷朋友圈一样，发现 AI 世界的新机会。
            </p>
          </div>

          <div className="relative hidden min-h-[360px] lg:block">
            <div className="absolute right-0 top-4 w-80 rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-lift backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-black text-slate-950">今日 AI 雷达</div>
                  <div className="text-sm text-slate-500">已为你筛选 12 条新机会</div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {["模型更新", "产品融资", "创作者案例"].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-soft">
                      +{index + 3}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-5 left-0 w-72 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-soft backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                已保存到你的 AI 灵感库
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                收藏高价值技巧、工具和案例，随时回看。
              </p>
            </div>
            <div className="absolute left-20 top-0 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lift">
              <Layers3 className="h-9 w-9" />
            </div>
            <div className="absolute bottom-0 right-24 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-white shadow-soft">
              <CalendarDays className="h-7 w-7" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-5">
          {filteredPosts.map((post) => (
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
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <HomeSidebar posts={allPosts} />
          </div>
        </aside>

        <div className="lg:hidden">
          <HomeSidebar posts={allPosts} />
        </div>
      </section>
    </div>
  );
}
