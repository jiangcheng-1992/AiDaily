import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileText, Link2, Scale } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "使用条款 | AI圈",
  description:
    "阅读 AI圈的网站使用条款，包括内容来源、用户责任、第三方链接、免责声明和知识产权说明。",
};

const terms = [
  {
    title: "内容与来源",
    icon: FileText,
    body: "AI圈聚合和整理公开网络中的 AI 资讯、产品、视频、作品与案例。我们会尽量标注来源并保留外部链接，但不保证所有内容在任何时间都完整、准确或持续可用。",
  },
  {
    title: "用户责任",
    icon: BadgeCheck,
    body: "你在使用投稿、反馈、收藏、账号等功能时，应提供真实、合法、不过度侵犯他人权益的信息，不得提交恶意代码、垃圾广告、侵权内容或违法内容。",
  },
  {
    title: "第三方链接",
    icon: Link2,
    body: "网站可能包含外部媒体、产品页、视频页、下载页和广告链接。外部网站由对应平台独立运营，其内容、安全性、隐私政策和交易行为不由 AI圈控制。",
  },
  {
    title: "免责声明",
    icon: Scale,
    body: "本站内容仅供信息参考，不构成投资、法律、医疗、职业、采购或其他专业建议。你应根据原始来源、官方说明和自身判断独立决策。",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-soft sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-amber-700 shadow-sm">
          <Scale className="h-4 w-4" />
          使用条款
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          使用 AI圈前，请了解这些基本规则
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          欢迎使用 AI圈。访问或使用本网站，即表示你理解并同意以下条款。若你不同意这些条款，请停止使用本站相关服务。
        </p>
        <p className="mt-4 text-sm font-semibold text-slate-500">最后更新：2026 年 5 月 28 日</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {terms.map((term) => (
          <Card key={term.title} className="rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <term.icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-slate-950">{term.title}</h2>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-600">{term.body}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">知识产权与版权反馈</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              AI圈自身的页面设计、整理方式、站内文案和代码受相关法律保护。来自第三方平台的原始内容、商标、图片、视频、产品信息和作品版权归其原权利人所有。
            </p>
            <p>
              如果你认为本站展示的内容侵犯了你的合法权益，请通过联系页面提供权属证明、问题链接和处理诉求。我们会在核实后尽快处理。
            </p>
          </div>
        </Card>

        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">服务变更</h2>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            我们可能根据产品规划、合规要求或技术条件调整栏目、功能、抓取来源、广告展示和访问策略。条款变更后继续使用本站，即视为接受更新后的条款。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white"
            >
              查看隐私政策
            </Link>
            <Link
              href="/contact"
              className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700"
            >
              联系我们
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
