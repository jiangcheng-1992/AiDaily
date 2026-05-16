import type { Metadata, Viewport } from "next";

import { MobileTabbar } from "@/components/mobile-tabbar";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI圈 | 每天 5 分钟，刷完 AI 圈新动态",
  description:
    "AI圈聚合每日 AI 新闻、大佬观点、实用技巧、热门产品和创作者案例。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <SiteHeader />
        <main className="pb-24 md:pb-12">{children}</main>
        <MobileTabbar />
      </body>
    </html>
  );
}
