"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Pencil,
  Trash2,
  FileText,
  Lightbulb,
  LinkIcon,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAiCircleStore } from "@/hooks/use-ai-circle-store";
import type { PostType } from "@/lib/mock-data";
import { postTypeMeta } from "@/lib/mock-data";

const typeOptions: PostType[] = ["news", "opinion", "tool", "skill", "product", "case"];

const initialForm = {
  title: "",
  type: "news" as PostType,
  sourceUrl: "",
  summary: "",
  whyItMatters: "",
  tags: "",
  author: "",
};

export function SubmitClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { submissions, addSubmission, updateSubmission, deleteSubmission, canManageSubmission } =
    useAiCircleStore();
  const [form, setForm] = useState(initialForm);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const editId = searchParams.get("edit");
  const editingPost = useMemo(
    () =>
      submissions.find(
        (post) => post.id === editId && canManageSubmission(post, user?.id, user?.name),
      ),
    [canManageSubmission, editId, submissions, user?.id, user?.name],
  );
  const isEditing = Boolean(editingPost);

  useEffect(() => {
    if (!user) return;
    if (editingPost) {
      setForm({
        title: editingPost.title,
        type: editingPost.type,
        sourceUrl: editingPost.sourceUrl ?? "",
        summary: editingPost.summary,
        whyItMatters: editingPost.whyItMatters,
        tags: editingPost.tags.join(" "),
        author: editingPost.author ?? user.name,
      });
      setSuccessId(null);
      setError("");
      return;
    }

    setForm((current) => ({
      ...initialForm,
      author: current.author.trim() || user.name,
    }));
    setSuccessId(null);
    setError("");
  }, [editingPost, user]);

  const canSubmit =
    form.title.trim() &&
    form.summary.trim() &&
    form.whyItMatters.trim() &&
    form.author.trim();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-[2rem] bg-white/95 p-8 text-center">
          <div className="mx-auto h-12 w-40 animate-pulse rounded-full bg-slate-100" />
          <div className="mx-auto mt-4 h-4 w-56 animate-pulse rounded-full bg-slate-100" />
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-[2rem] bg-white/95 p-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
            <SendHorizontal className="h-4 w-4" />
            投稿
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950">
            登录后发布并管理你的投稿
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            当前版本支持“我的投稿”编辑和删除。为了区分作者身份，请先登录再投稿。
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/auth"
              className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white"
            >
              去登录
            </Link>
            <Link
              href="/me"
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700"
            >
              回我的主页
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <Card className="rounded-[2rem] bg-white/95 p-5 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
            {isEditing ? <Pencil className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}
            {isEditing ? "编辑投稿" : "投稿"}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
            {isEditing ? "修改你的投稿" : "分享你的发现"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            为 AI 社区贡献有价值的新闻、工具、观点或案例。当前版本会把投稿保存在本地，并和你的账号绑定，方便你继续编辑或删除。
          </p>
        </div>

        {successId ? (
          <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 className="h-5 w-5" />
              {isEditing ? "投稿已更新" : "投稿已保存"}
            </div>
            <p className="mt-2 text-sm leading-6">
              你的内容已经写入本地信息流，可以在首页、详情页或我的投稿中继续管理。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/post/${successId}`}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              >
                查看详情
              </Link>
              <Link
                href="/"
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-700"
              >
                回首页
              </Link>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            setError("");
            const payload = {
              ...form,
              ownerId: user.id,
              ownerName: user.name,
              ownerEmail: user.email,
            };
            const post = editingPost
              ? updateSubmission(editingPost.id, payload, user.id, user.name)
              : addSubmission(payload);
            if (!post) {
              setError("这条投稿暂时无法编辑，请返回“我的主页”后重试");
              return;
            }
            setSuccessId(post.id);
            if (!editingPost) {
              setForm({ ...initialForm, author: user.name });
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="title">
              标题 <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="输入清晰明确的标题，例如：OpenAI 发布全新模型..."
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">
                类型 <span className="text-rose-500">*</span>
              </Label>
              <select
                id="type"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as PostType })
                }
                className="h-12 w-full rounded-2xl border border-transparent bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {postTypeMeta[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">
                投稿人昵称 <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="author"
                value={form.author}
                onChange={(event) => setForm({ ...form, author: event.target.value })}
                placeholder="例如：AI 探索者"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">来源链接</Label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="sourceUrl"
                value={form.sourceUrl}
                onChange={(event) =>
                  setForm({ ...form, sourceUrl: event.target.value })
                }
                placeholder="https://..."
                className="pl-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">
              简介 <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="summary"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              placeholder="简要描述该内容的核心价值、主要功能或你的核心观点..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whyItMatters">
              为什么重要 <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="whyItMatters"
              value={form.whyItMatters}
              onChange={(event) =>
                setForm({ ...form, whyItMatters: event.target.value })
              }
              placeholder="说明它会影响哪些人、解决什么问题，或带来什么新机会。"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">标签</Label>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="tags"
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                placeholder="输入标签并用空格或逗号分隔，如：LLM 图像生成"
                className="pl-11"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="gradient" size="lg" className="flex-1" disabled={!canSubmit}>
              <SendHorizontal className="h-5 w-5" />
              {isEditing ? "保存修改" : "发布投稿"}
            </Button>
            {isEditing ? (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-w-32"
                disabled={isDeleting}
                onClick={() => {
                  if (!editingPost) return;
                  const confirmed = window.confirm("确认删除这条投稿吗？删除后将无法恢复。");
                  if (!confirmed) return;

                  setIsDeleting(true);
                  const deleted = deleteSubmission(editingPost.id, user.id, user.name);
                  setIsDeleting(false);

                  if (!deleted) {
                    setError("删除失败，这条投稿可能已经不存在");
                    return;
                  }

                  router.push("/me");
                }}
              >
                <Trash2 className="h-5 w-5" />
                {isDeleting ? "删除中..." : "删除投稿"}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="rounded-3xl border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-5">
          <div className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Sparkles className="h-5 w-5 text-blue-700" />
            推荐 AI 作品
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            发现好玩的 AI 图片、视频、网站、小游戏、Prompt 或开源项目，可以先推荐到“有点意思”。
          </p>
          <Link
            href="/interesting"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-700"
          >
            去看有点意思
          </Link>
        </Card>

        <Card className="rounded-3xl p-5">
          <div className="flex items-center gap-2 text-lg font-black text-blue-700">
            <Lightbulb className="h-5 w-5" />
            投稿指南
          </div>
          <div className="mt-5 space-y-5">
            <GuideItem
              icon={Sparkles}
              title="高质量内容"
              text="请确保内容真实、有价值，避免重复发布已经存在的资讯。"
            />
            <GuideItem
              icon={FileText}
              title="清晰的描述"
              text="简介部分尽量提炼核心要点，帮助读者快速了解内容价值。"
            />
            <GuideItem
              icon={ShieldCheck}
              title="审核标准"
              text="后续接入真实后端后，投稿会进入审核队列，低俗广告和误导内容会被拒绝。"
            />
          </div>
        </Card>
      </aside>
    </div>
  );
}

function GuideItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-black text-slate-950">{title}</div>
        <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
      </div>
    </div>
  );
}
