import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { MobileTabbar } from "@/components/mobile-tabbar";
import { PrivacyConsentDialog } from "@/components/privacy-consent-dialog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ADSENSE_CLIENT } from "@/lib/google-ads";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-0W61YMLPCN";
const BAIDU_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_BAIDU_SITE_VERIFICATION ?? "codeva-PW6SzpKQQx";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "AI圈",
  title: {
    default: "AI圈 | 每天 5 分钟，刷完 AI 圈新动态",
    template: "%s | AI圈",
  },
  description:
    "AI圈聚合每日 AI 新闻、大佬观点、实用技巧、热门产品、AI 作品、浏览器游戏、视频和创作者案例。",
  keywords: ["AI圈", "AI新闻", "AI工具", "AI产品", "AI视频", "AI游戏", "AI作品", "大模型"],
  authors: [{ name: "AI圈编辑部", url: siteUrl }],
  creator: "AI圈",
  publisher: "AI圈",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "AI圈",
    url: siteUrl,
    title: "AI圈 | 每天 5 分钟，刷完 AI 圈新动态",
    description:
      "聚合每日 AI 新闻、热门产品、实用技巧、AI 作品、视频、游戏和创作者案例。",
    images: [
      {
        url: absoluteUrl("/icons/icon-512.png"),
        width: 512,
        height: 512,
        alt: "AI圈",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI圈 | 每天 5 分钟，刷完 AI 圈新动态",
    description: "每日 AI 新闻、热门产品、AI 作品、视频、游戏和创作者案例。",
    images: [absoluteUrl("/icons/icon-512.png")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "baidu-site-verification": BAIDU_SITE_VERIFICATION,
    },
  },
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
        <meta name="baidu-site-verification" content={BAIDU_SITE_VERIFICATION} />
        {ADSENSE_CLIENT ? (
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
        <SiteFooter />
        <MobileTabbar />
        <PrivacyConsentDialog />
      </body>
    </html>
  );
}
