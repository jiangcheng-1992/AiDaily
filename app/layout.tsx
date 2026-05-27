import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { MobileTabbar } from "@/components/mobile-tabbar";
import { SiteHeader } from "@/components/site-header";
import { ADSENSE_CLIENT, GOOGLE_ADSENSE_ENABLED } from "@/lib/google-ads";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-0W61YMLPCN";

export const metadata: Metadata = {
  title: "AI圈 | 每天 5 分钟，刷完 AI 圈新动态",
  description:
    "AI圈聚合每日 AI 新闻、大佬观点、实用技巧、热门产品和创作者案例。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8fafc",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {GOOGLE_ADSENSE_ENABLED && ADSENSE_CLIENT ? (
          <script
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        ) : null}
      </head>
      <body className="overflow-x-hidden antialiased">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <SiteHeader />
        <main className="pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-12">{children}</main>
        <MobileTabbar />
      </body>
    </html>
  );
}
