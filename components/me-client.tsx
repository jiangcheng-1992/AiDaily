"use client";

import Link from "next/link";
import {
  Bell,
  Bookmark,
  ChevronRight,
  LogOut,
  MessageCircle,
  PenLine,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

import { PostTypeBadge } from "@/components/post-type-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import { cn, formatRelativeTime } from "@/lib/utils";

export function MeClient() {
  const { savedPostIds, submissions, commentsByPost } = useAiCircleStore();
  const { user, loading, logout } = useAuth();
  const commentCount = Object.values(commentsByPost).reduce(
    (total, comments) => total + comments.length,
    0,
  );

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full rounded-[2rem] p-8 text-center shadow-lift">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-3xl bg-blue-50" />
          <div className="mx-auto mt-5 h-8 w-56 animate-pulse rounded-full bg-slate-100" />
          <div className="mx-auto mt-3 h-4 w-72 animate-pulse rounded-full bg-slate-100" />
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full rounded-[2rem] p-8 text-center shadow-lift">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
            <UserRound className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-normal text-slate-950">
            登录后查看你的 AI 圈
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            登录或注册后，可以查看个人资料、收藏、投稿和评论记录。
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/auth" className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}>
              登录 / 注册
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="overflow-hidden rounded-[2rem] bg-white/95">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-8 text-white">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/18 text-3xl font-black shadow-soft ring-1 ring-white/30">
                {user.avatarText}
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-normal">{user.name}</h1>
                <p className="mt-2 text-blue-50">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/25">
                <Sparkles className="h-4 w-4" />
                已登录
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <StatCard icon={Bookmark} label="我的收藏" value={savedPostIds.length} href="/saved" />
          <StatCard icon={PenLine} label="我的投稿" value={submissions.length} href="/submit" />
          <StatCard icon={MessageCircle} label="我的评论" value={commentCount} href="#comments" />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-[2rem] p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">我的投稿</h2>
            <Link
              href="/submit"
              className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700"
            >
              继续投稿
            </Link>
          </div>
          {submissions.length ? (
            <div className="space-y-3">
              {submissions.map((post) => (
                <Link
                  href={`/post/${post.id}`}
                  key={post.id}
                  className="group block rounded-3xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-blue-50/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <PostTypeBadge type={post.type} />
                    <span className="text-xs font-semibold text-slate-400">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-black leading-6 text-slate-900 group-hover:text-blue-700">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                    {post.summary}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">
              <PenLine className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                还没有投稿。发现好内容时，把它投进 AI 圈吧。
              </p>
            </div>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="rounded-[2rem] p-5">
            <h2 className="text-xl font-black text-slate-950">设置</h2>
            <div className="mt-4 space-y-2">
              <SettingRow icon={UserRound} label="账号资料" />
              <SettingRow icon={Bell} label="消息通知" />
              <SettingRow icon={Settings} label="偏好设置" />
            </div>
          </Card>

          <Card id="comments" className="rounded-[2rem] p-5">
            <h2 className="text-xl font-black text-slate-950">我的评论</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              你已在本地发布 {commentCount} 条评论。真实后端上线后，这里会展示完整评论历史和互动提醒。
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Bookmark;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 transition-colors hover:bg-blue-50"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-soft">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-2xl font-black text-slate-950">{value}</span>
          <span className="text-sm font-semibold text-slate-500">{label}</span>
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  );
}

function SettingRow({
  icon: Icon,
  label,
}: {
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
    >
      <span className="flex items-center gap-3 text-sm font-bold text-slate-700">
        <Icon className="h-4 w-4 text-blue-700" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-300" />
    </button>
  );
}
