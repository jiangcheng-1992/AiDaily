import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Newspaper, Sparkles, Target } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "关于我们 | AI圈",
  description:
    "了解 AI圈的定位、内容来源、编辑原则和适合阅读的人群。AI圈聚合每日 AI 新闻、热门产品、视频、游戏和创作者案例。",
};

const principles = [
  {
    title: "快速了解 AI 动态",
    description:
      "我们希望把分散在媒体、社区、产品平台和视频站点中的 AI 信息整理成更容易浏览的日常入口。",
    icon: Newspaper,
  },
  {
    title: "关注实用与趋势",
    description:
      "内容覆盖 AI 新闻、大模型进展、产品发布、工具案例、创作者作品和有趣的 AI 应用。",
    icon: Sparkles,
  },
  {
    title: "保留来源与判断",
    description:
      "文章和作品会尽量保留原始来源链接，读者可以继续访问原文、产品页或视频详情页核对完整信息。",
    icon: Target,
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 shadow-soft sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-blue-700 shadow-sm">
          <Bot className="h-4 w-4" />
          关于 AI圈
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          每天 5 分钟，刷完 AI 圈新动态
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          AI圈是一个面向中文读者的 AI 信息聚合与发现网站。我们持续整理 AI
          行业新闻、热门产品、技术观点、实用技巧、视频内容、独立游戏和创作者案例，帮助读者更高效地发现值得关注的新变化。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft"
          >
            浏览今日动态
          </Link>
          <Link
            href="/interesting"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            查看有点意思
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {principles.map((item) => (
          <Card key={item.title} className="rounded-3xl p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <item.icon className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">我们如何组织内容</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              首页信息流主要聚合 AI 相关新闻、观点和技巧；“有点意思”栏目关注更偏作品、产品和灵感发现的内容，包括 Product Hunt、itch.io、YouTube、Vimeo、liblib.tv 等来源。
            </p>
            <p>
              部分内容会通过自动抓取、规则筛选和页面解析生成摘要与封面；我们会持续优化分类、来源链接、封面质量和重复内容过滤，尽量让信息更清晰、可追溯。
            </p>
            <p>
              AI圈不替代原始媒体、作者或平台。涉及产品购买、下载、投资、法律、医疗等决策时，请以原始来源和官方说明为准。
            </p>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">适合谁阅读</h2>
          <ul className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
            <li>AI 产品经理、创业者和独立开发者</li>
            <li>关注大模型、Agent、AIGC 工具的从业者</li>
            <li>想快速了解 AI 新闻和热门产品的读者</li>
            <li>寻找灵感、案例和工具的创作者</li>
          </ul>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white"
          >
            联系我们
          </Link>
        </Card>
      </section>
    </div>
  );
}
