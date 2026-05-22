"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  ChevronRight,
  DatabaseZap,
  Globe2,
  LogOut,
  MessageCircle,
  Pencil,
  PenLine,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { PostTypeBadge } from "@/components/post-type-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import { cn, formatRelativeTime } from "@/lib/utils";

type SubmittedSource = {
  id: string;
  kind: string;
  name: string;
  url: string;
  status: "active" | "error";
  lastFetchedAt?: string;
  lastError?: string;
  lastPostCount?: number;
};

export function MeClient() {
  const { savedPostIds, submissions, commentsByPost, canManageSubmission, deleteSubmission } =
    useAiCircleStore();
  const { user, loading, logout } = useAuth();
  const ownedSubmissions = user
    ? submissions.filter((post) => canManageSubmission(post, user.id, user.name))
    : [];
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
          <StatCard icon={PenLine} label="我的投稿" value={ownedSubmissions.length} href="/submit" />
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
          {ownedSubmissions.length ? (
            <div className="space-y-3">
              {ownedSubmissions.map((post) => (
                <div
                  key={post.id}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-blue-50/60"
                >
                  <Link href={`/post/${post.id}`} className="group block">
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/submit?edit=${encodeURIComponent(post.id)}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm("确认删除这条投稿吗？删除后不可恢复。");
                        if (!confirmed) return;
                        deleteSubmission(post.id, user.id, user.name);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                </div>
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
          {user.isAdmin ? <AdminSourcePanel /> : null}

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

function AdminSourcePanel() {
  const [sources, setSources] = useState<SubmittedSource[]>([]);
  const [form, setForm] = useState({
    kind: "auto",
    name: "",
    url: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSources();
  }, []);

  async function loadSources() {
    try {
      const response = await fetch("/api/admin/sources", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        sources?: SubmittedSource[];
      };
      if (response.ok && data.ok) {
        setSources(data.sources ?? []);
      }
    } catch {
      // The panel can still submit even if history failed to load.
    }
  }

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.url.trim()) return;

    setLoading(true);
    setError("");
    setMessage("正在保存信息源并触发抓取...");

    try {
      const response = await fetch("/api/admin/sources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          itemLimit: 3,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        postCount?: number;
        totalPostCount?: number;
        source?: SubmittedSource;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "信息源提交失败");
      }

      setMessage(
        `已抓取 ${data.postCount ?? 0} 条内容，当前 feed 共 ${data.totalPostCount ?? 0} 条。`,
      );
      setForm({ kind: "auto", name: "", url: "" });
      await loadSources();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "信息源提交失败");
      setMessage("");
      await loadSources();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-[2rem] border-blue-100 bg-blue-50/45 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-soft">
          <DatabaseZap className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-950">提交信息源</h2>
          <p className="text-xs font-semibold text-blue-700">管理员入口</p>
        </div>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submitSource}>
        <select
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value })}
          className="h-11 w-full rounded-2xl border border-white bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="auto">自动识别</option>
          <option value="website">网站主页</option>
          <option value="rss">RSS / Atom</option>
          <option value="douyin">抖音作者</option>
          <option value="bilibili">B站作者</option>
          <option value="youtube">YouTube 作者</option>
        </select>
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="信息源名称，可选"
          className="h-11 w-full rounded-2xl border border-white bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        />
        <input
          value={form.url}
          onChange={(event) => setForm({ ...form, url: event.target.value })}
          placeholder="粘贴网站、RSS、抖音/B站/YouTube 作者链接"
          className="h-11 w-full rounded-2xl border border-white bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          disabled={loading || !form.url.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-soft transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
          {loading ? "正在抓取" : "提交并抓取"}
        </button>
      </form>

      {message ? (
        <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {sources.slice(0, 4).map((source) => (
          <div key={source.id} className="rounded-2xl bg-white/90 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="line-clamp-1 font-black text-slate-800">{source.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-black",
                  source.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700",
                )}
              >
                {source.status === "active" ? "可用" : "异常"}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-slate-400">{source.url}</p>
            {source.lastPostCount !== undefined ? (
              <p className="mt-1 font-bold text-slate-500">最近抓取 {source.lastPostCount} 条</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
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
