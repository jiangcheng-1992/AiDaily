import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Megaphone, MessageSquareText, Send } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "联系我们 | AI圈",
  description:
    "联系 AI圈进行内容投稿、产品收录、来源纠错、版权反馈和合作沟通。",
};

const contactTopics = [
  {
    title: "内容投稿",
    description: "推荐 AI 新闻、产品、工具、案例、视频或独立作品。",
    icon: Send,
  },
  {
    title: "信息纠错",
    description: "反馈标题、封面、分类、来源链接或摘要不准确的问题。",
    icon: MessageSquareText,
  },
  {
    title: "合作沟通",
    description: "围绕 AI 产品展示、内容合作、广告位和品牌曝光进行沟通。",
    icon: Megaphone,
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/70 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-soft sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-blue-100 ring-1 ring-white/15">
          <Mail className="h-4 w-4" />
          联系 AI圈
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal sm:text-5xl">
          投稿、纠错、合作，都可以从这里开始
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-blue-100/85">
          如果你希望推荐内容、提交产品、反馈版权或来源问题，欢迎通过邮件或投稿入口联系我们。请尽量提供清晰的标题、链接、截图和补充说明，方便我们更快处理。
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {contactTopics.map((item) => (
          <Card key={item.title} className="rounded-3xl p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <item.icon className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">主要联系方式</h2>
          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Email
            </p>
            <a
              href="mailto:contact@aidaily.site"
              className="mt-2 block break-all text-lg font-black text-blue-700 hover:underline"
            >
              contact@aidaily.site
            </a>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              如果该邮箱后续有变更，请以网站页脚或最新联系页面展示的信息为准。
            </p>
          </div>
          <Link
            href="/submit"
            className="mt-5 inline-flex rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft"
          >
            去投稿页面
          </Link>
        </Card>

        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">反馈时建议包含</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "相关页面链接",
              "内容标题或截图",
              "你希望我们处理的问题",
              "可公开展示的署名信息",
              "版权或授权证明",
              "可回复的联系方式",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-500">
            我们会优先处理影响内容准确性、版权归属、用户安全和广告合规的问题。普通收录和合作请求会根据内容匹配度、排期和站点规划处理。
          </p>
        </Card>
      </section>
    </div>
  );
}
