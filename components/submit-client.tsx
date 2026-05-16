"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
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
  const { addSubmission } = useAiCircleStore();
  const [form, setForm] = useState(initialForm);
  const [successId, setSuccessId] = useState<string | null>(null);

  const canSubmit =
    form.title.trim() &&
    form.summary.trim() &&
    form.whyItMatters.trim() &&
    form.author.trim();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <Card className="rounded-[2rem] bg-white/95 p-5 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
            <SendHorizontal className="h-4 w-4" />
            投稿
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
            分享您的发现
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            为 AI 社区贡献有价值的新闻、工具、观点或案例。当前版本会把投稿保存在本地，并立刻出现在首页信息流里。
          </p>
        </div>

        {successId ? (
          <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 className="h-5 w-5" />
              投稿已保存
            </div>
            <p className="mt-2 text-sm leading-6">
              你的内容已经加入本地信息流，可以在首页或我的投稿中查看。
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

        <form
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            const post = addSubmission(form);
            setSuccessId(post.id);
            setForm(initialForm);
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

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
          >
            <SendHorizontal className="h-5 w-5" />
            发布投稿
          </Button>
        </form>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
