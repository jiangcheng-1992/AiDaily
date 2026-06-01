import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck2,
  Globe2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { absoluteUrl, JsonLdScript, seoTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

const apkDownloadPath = "/downloads/aiquan-latest.apk";
const apkDownloadUrl = absoluteUrl(apkDownloadPath);
const appVersion = "1.0.0";

export const metadata: Metadata = {
  title: seoTitle("AI圈 APK 下载"),
  description:
    "下载 AI圈 Android APK，随时查看 AI 新闻、今日热门、榜单、有点意思和 AI 作品灵感。",
  alternates: {
    canonical: absoluteUrl("/download"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/download"),
    title: "AI圈 APK 下载",
    description: "下载 AI圈 Android APK，随时查看每日 AI 动态、榜单和有趣作品。",
    images: [
      {
        url: absoluteUrl("/icons/icon-512.png"),
        width: 512,
        height: 512,
        alt: "AI圈",
      },
    ],
  },
};

const highlights = [
  "每日 AI 新闻、热门产品和研究动态",
  "今日热门、榜单和精选作品快速浏览",
  "有点意思：发现 AI 网站、游戏、视频和 Skill",
  "移动端沉浸阅读，适合碎片时间快速了解 AI 圈",
];

const installSteps = [
  {
    title: "下载 APK",
    description: "点击页面中的下载按钮，将安装包保存到 Android 手机。",
  },
  {
    title: "允许安装",
    description: "如系统提示，请为浏览器或文件管理器开启“安装未知应用”权限。",
  },
  {
    title: "完成安装",
    description: "安装后打开 AI圈，即可浏览每日 AI 动态和作品灵感。",
  },
];

const trustItems = [
  {
    title: "官网发布",
    description: "安装包固定通过 aiquan.me 官网页面提供，避免下载来源混乱。",
    icon: Globe2,
  },
  {
    title: "隐私说明",
    description: "应用隐私政策和用户协议公开可查，审核和用户都可直接访问。",
    icon: ShieldCheck,
  },
  {
    title: "版本可追踪",
    description: "页面保留版本号、更新时间和更新说明，便于应用商店审核。",
    icon: FileCheck2,
  },
];

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AI圈",
          applicationCategory: "NewsApplication",
          operatingSystem: "Android",
          softwareVersion: appVersion,
          downloadUrl: apkDownloadUrl,
          url: absoluteUrl("/download"),
          image: absoluteUrl("/icons/icon-512.png"),
          description: "AI圈是一款面向中文读者的 AI 新闻、榜单和作品发现应用。",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "CNY",
          },
        }}
      />

      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/80 bg-[#071022] px-5 py-8 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:px-8 sm:py-10 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(79,70,229,0.42),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(14,165,233,0.32),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_46%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-blue-100 ring-1 ring-white/15">
              <Smartphone className="h-4 w-4" />
              Android APK 官方下载
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] sm:text-5xl">
              把 AI圈装进手机，每天 5 分钟刷完 AI 新动态
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              AI圈 Android 版聚合每日 AI 新闻、热门榜单、AI 作品、网站、游戏和创作者灵感，适合通勤、午休和碎片时间快速浏览。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={apkDownloadPath}
                download
                className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "bg-white text-blue-700 hover:text-white")}
              >
                <Download className="h-5 w-5" />
                下载 Android APK
              </a>
              <Link href="/privacy" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-950")}>
                查看隐私政策
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-blue-100">
              <span className="rounded-full bg-white/10 px-3 py-1.5">版本 {appVersion}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">Android 8.0+</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">官网来源 aiquan.me</span>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-[2rem] border-white/20 bg-white/95 p-6 text-slate-950 shadow-lift">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.8rem] bg-gradient-to-br from-blue-50 to-violet-100 shadow-inner">
              <Image src="/icons/icon-512.png" alt="AI圈 App 图标" width={72} height={72} className="rounded-2xl" priority />
            </div>
            <h2 className="mt-5 text-center text-2xl font-black">AI圈</h2>
            <p className="mt-2 text-center text-sm font-semibold text-slate-500">
              AI 新闻、榜单、作品和灵感发现
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs font-bold text-slate-500">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <div className="text-base font-black text-slate-950">免费</div>
                <div>下载使用</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <div className="text-base font-black text-slate-950">移动端</div>
                <div>沉浸阅读</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Smartphone className="h-5 w-5 text-blue-600" />
            应用亮点
          </div>
          <ul className="mt-5 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex gap-3 text-sm font-semibold leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Download className="h-5 w-5 text-blue-600" />
            安装说明
          </div>
          <div className="mt-5 space-y-4">
            {installSteps.map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-950">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {trustItems.map((item) => (
          <Card key={item.title} className="rounded-[2rem] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <item.icon className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
          </Card>
        ))}
      </section>

      <Card className="mt-8 rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-black">应用商店审核资料</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              本页可作为应用商店审核时的官网 APK 下载页。隐私政策、用户协议、联系我们等基础页面均可通过网站底部访问。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/terms" className={cn(buttonVariants({ variant: "outline" }), "border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-950")}>
              用户协议
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "outline" }), "border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-950")}>
              联系我们
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
