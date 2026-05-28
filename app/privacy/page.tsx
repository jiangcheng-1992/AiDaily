import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, Database, ShieldCheck, UserRoundCheck } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "隐私政策 | AI圈",
  description:
    "了解 AI圈如何处理访问数据、账号信息、Cookies、第三方服务和广告相关数据。",
};

const sections = [
  {
    title: "我们可能收集的信息",
    icon: Database,
    items: [
      "访问页面、设备类型、浏览器、来源页面、访问时间等基础统计信息。",
      "你主动提交的投稿内容、反馈信息、联系方式和账号相关资料。",
      "用于登录、收藏、偏好设置和安全防护的必要技术信息。",
    ],
  },
  {
    title: "Cookies 与广告",
    icon: Cookie,
    items: [
      "网站可能使用 Cookies 或类似技术保存登录状态、基础偏好和访问统计。",
      "我们可能接入 Google AdSense 等第三方广告服务，广告服务商可能依据其政策使用 Cookies 展示和衡量广告。",
      "你可以在浏览器中管理或禁用 Cookies，但部分功能可能受到影响。",
    ],
  },
  {
    title: "信息用途",
    icon: UserRoundCheck,
    items: [
      "维护网站运行、改进内容推荐、优化页面体验和排查异常问题。",
      "处理投稿、纠错、版权反馈、合作请求和用户支持。",
      "进行匿名化数据分析，了解哪些内容更受读者关注。",
    ],
  },
  {
    title: "数据安全",
    icon: ShieldCheck,
    items: [
      "我们会采取合理的技术和管理措施保护数据安全。",
      "除法律要求、服务运行必要或获得授权外，不会主动出售你的个人信息。",
      "第三方链接、嵌入内容和外部平台由对应服务方独立负责其隐私实践。",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/70 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6 shadow-soft sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-emerald-700 shadow-sm">
          <ShieldCheck className="h-4 w-4" />
          隐私政策
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          我们重视你的隐私与数据安全
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          本隐私政策说明 AI圈在提供网站浏览、账号功能、投稿反馈、内容统计和广告服务时，可能如何收集、使用和保护相关信息。继续使用本网站即表示你理解并同意本政策。
        </p>
        <p className="mt-4 text-sm font-semibold text-slate-500">最后更新：2026 年 5 月 28 日</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <section.icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      <section className="mt-8">
        <Card className="rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950">你的选择与联系我们</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              你可以通过浏览器设置管理 Cookies，也可以停止使用需要登录的功能。若你希望查询、更正或删除你主动提交的信息，可以通过联系页面向我们说明具体请求。
            </p>
            <p>
              本政策可能会随产品功能、法律要求或第三方服务变化而更新。重要变更会尽量在页面中体现，建议你定期查看。
            </p>
          </div>
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
