import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Gamepad2, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { mockPosts } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function InterestingPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const generatedFeed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });
  const worksFeed = await readGeneratedWorks({ allowFallback: false });
  const skillWorks = buildInterestingSkillWorks([...generatedFeed.posts, ...mockPosts]);
  const work = [...skillWorks, ...worksFeed.works].find((item) => item.id === id);

  if (!work || work.source !== "itchio" || !work.externalUrl) notFound();

  const frameUrl = await resolveItchioFrameUrl(work.externalUrl);

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/interesting/${work.id}`}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-soft transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回作品详情
        </Link>
        <a
          href={work.externalUrl}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-soft"
        >
          打开 itch.io 原页
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <Card className="overflow-hidden rounded-2xl bg-slate-950 p-0 shadow-lift sm:rounded-[2rem]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              <Gamepad2 className="h-3.5 w-3.5" />
              App 内试玩
            </div>
            <h1 className="mt-1 line-clamp-1 text-base font-black sm:mt-2 sm:text-xl">{work.title}</h1>
          </div>
          <a
            href={`/interesting/${work.id}/play?refresh=1`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </a>
        </div>

        <div className="relative h-[calc(100svh-9rem)] min-h-[430px] bg-black sm:h-[calc(100vh-11rem)] sm:min-h-[520px]">
          <iframe
            src={frameUrl}
            title={work.title}
            allow="autoplay; fullscreen *; geolocation; microphone; camera; midi; monetization; xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share; clipboard-read; clipboard-write"
            allowFullScreen
            loading="eager"
            scrolling="no"
            className="h-full w-full border-0 bg-black"
          />
        </div>
      </Card>

      {frameUrl === work.externalUrl ? (
        <Card className="mt-4 rounded-3xl p-5">
          <p className="text-sm leading-7 text-slate-600">
            这个游戏没有解析到 itch.io 的直接运行地址，已在 App 内加载原页面。若页面提示登录、弹窗或无法开始，请点击“打开 itch.io 原页”继续。
          </p>
        </Card>
      ) : null}
    </div>
  );
}

async function resolveItchioFrameUrl(gameUrl: string) {
  try {
    const response = await fetch(gameUrl, {
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "Mozilla/5.0 AIQ/1.0 itch.io app player",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return undefined;

    const html = await response.text();
    const iframeUrl = extractItchioIframeUrl(html);
    if (iframeUrl) return iframeUrl;

    const rawPlayUrl = html.match(/"play_url":"([^"]+)"/)?.[1];
    if (!rawPlayUrl) return gameUrl;

    const playUrl = decodeJsonString(rawPlayUrl);
    return /^https:\/\/[^/]+\.itch\.io\/.+\/rp\//i.test(playUrl) ? playUrl : gameUrl;
  } catch {
    return gameUrl;
  }
}

function extractItchioIframeUrl(html: string) {
  const iframeMatches = html.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"[^>]*>/gi);

  for (const match of iframeMatches) {
    const iframeHtml = match[0];
    const src = decodeHtmlAttribute(match[1] ?? "");
    if (!src) continue;

    const embedUploadUrl = toItchioEmbedUploadUrl(src);
    if (embedUploadUrl) return embedUploadUrl;

    const isGameIframe =
      iframeHtml.includes("game_drop") ||
      iframeHtml.includes("allowfullscreen") ||
      /https:\/\/itch\.io\/embed-upload\//i.test(src);

    if (isGameIframe && isSafeItchioFrameUrl(src)) return src;
  }

  return undefined;
}

function isSafeItchioFrameUrl(value: string) {
  return /^https:\/\/itch\.io\/embed-upload\//i.test(value) || /^https:\/\/[^/]+\.itch\.io\//i.test(value);
}

function toItchioEmbedUploadUrl(value: string) {
  const uploadId = value.match(/^https:\/\/[^/]+\.itch\.zone\/html\/(\d+)\//i)?.[1];
  return uploadId ? `https://itch.io/embed-upload/${uploadId}?color=191919` : undefined;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
  }
}
