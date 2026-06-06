import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, Gamepad2, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import { interestingWorks } from "@/lib/interesting-works";
import { mockPosts } from "@/lib/mock-data";
import { ItchioGameFrame } from "./itchio-game-frame";

export const dynamic = "force-dynamic";

export default async function InterestingPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string; refresh?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedMode = query?.mode === "direct" ? "direct" : "embed";
  const generatedFeed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });
  const worksFeed = await readGeneratedWorks({ allowFallback: false });
  const skillWorks = buildInterestingSkillWorks([...generatedFeed.posts, ...mockPosts]);
  const work = [...skillWorks, ...worksFeed.works, ...interestingWorks].find((item) => item.id === id);

  if (!work || work.source !== "itchio" || !work.externalUrl) notFound();

  const itchioPlaybackEnabled = process.env.ENABLE_ITCHIO_PLAYER === "1";
  const savedFrameSelection = work.videoUrl ? selectSavedFrameUrl(work.videoUrl, requestedMode) : undefined;
  const frameSelection = itchioPlaybackEnabled
    ? savedFrameSelection ?? (await resolveItchioFrameUrl(work.externalUrl, requestedMode))
    : { url: undefined, mode: "unavailable" as const };
  const frameUrl = frameSelection?.url;
  const activeMode = frameSelection?.mode === "direct" ? "direct" : "embed";
  const switchMode = activeMode === "direct" ? "embed" : "direct";
  const nextRefresh = query?.refresh === "1" ? "2" : "1";
  const reloadUrl = `/interesting/${work.id}/play?mode=${activeMode}&refresh=${nextRefresh}`;
  const switchModeUrl = `/interesting/${work.id}/play?mode=${switchMode}&refresh=${nextRefresh}`;

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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {frameUrl ? (
              <>
                <a
                  href={work.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-white/90"
                >
                  打开原网站
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={reloadUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新加载
                </a>
              </>
            ) : (
              <Link
                href="/interesting?tab=game"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-white/90"
              >
                返回游戏列表
              </Link>
            )}
          </div>
        </div>

        {frameUrl ? (
          <ItchioGameFrame
            key={`${frameUrl}-${query?.refresh ?? "0"}`}
            title={work.title}
            frameUrl={frameUrl}
            externalUrl={work.externalUrl}
            reloadUrl={reloadUrl}
            switchModeUrl={switchModeUrl}
            modeLabel={activeMode === "direct" ? "直连兼容模式" : "内嵌兼容模式"}
          />
        ) : (
          <div className="flex min-h-[430px] items-center justify-center bg-slate-100 p-5 sm:min-h-[520px]">
            <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lift">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-950">这个游戏已临时下线</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                当前 itch.io 游戏在端内和原站访问都不稳定，已暂停加载，避免页面白屏或一直卡住。可以先返回游戏列表查看已恢复的稳定内容。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/interesting?tab=game"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white"
                >
                  返回游戏列表
                </Link>
              </div>
            </div>
          </div>
        )}
      </Card>

      {frameSelection?.mode === "unavailable" ? (
        <Card className="mt-4 rounded-3xl p-5">
          <p className="text-sm leading-7 text-slate-600">
            已识别为当前不可稳定端内试玩的 itch.io 游戏。后续抓取会优先过滤这类无法解析内嵌地址或原站超时的条目。
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function selectSavedFrameUrl(frameUrl: string, requestedMode: "embed" | "direct") {
  const embedUrl = toItchioEmbedUploadUrl(frameUrl);
  const directUrl = toItchioPlayableUrl(frameUrl);

  if (requestedMode === "direct" && directUrl) return { url: directUrl, mode: "direct" as const };
  if (embedUrl) return { url: embedUrl, mode: "embed" as const };
  if (directUrl) return { url: directUrl, mode: "direct" as const };

  return undefined;
}

async function resolveItchioFrameUrl(gameUrl: string, requestedMode: "embed" | "direct") {
  try {
    const response = await fetch(gameUrl, {
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "Mozilla/5.0 AIQ/1.0 itch.io app player",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return { url: undefined, mode: "unavailable" as const };

    const html = await response.text();
    const frameCandidate = extractItchioFrameCandidate(html);
    const bestPlayableUrl = await chooseItchioPlayableUrl(frameCandidate, requestedMode);
    if (bestPlayableUrl) return bestPlayableUrl;

    const rawPlayUrl = html.match(/"play_url":"([^"]+)"/)?.[1];
    if (!rawPlayUrl) return { url: undefined, mode: "unavailable" as const };

    const playUrl = decodeJsonString(rawPlayUrl);
    return /^https:\/\/[^/]+\.itch\.io\/.+\/rp\//i.test(playUrl)
      ? { url: playUrl, mode: "direct" as const }
      : { url: undefined, mode: "unavailable" as const };
  } catch {
    return { url: undefined, mode: "unavailable" as const };
  }
}

function extractItchioFrameCandidate(html: string) {
  const embeddedCandidate = extractItchioEmbeddedFrameCandidate(html);
  if (embeddedCandidate.directUrl || embeddedCandidate.embedUrl) return embeddedCandidate;

  const iframeMatches = html.matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"[^>]*>/gi);

  for (const match of iframeMatches) {
    const iframeHtml = match[0];
    const src = decodeHtmlAttribute(match[1] ?? "");
    if (!src) continue;

    const directUrl = toItchioPlayableUrl(src);
    const embedUrl = toItchioEmbedUploadUrl(src);
    if (directUrl || embedUrl) {
      return { directUrl, embedUrl };
    }

    const isGameIframe =
      iframeHtml.includes("game_drop") ||
      iframeHtml.includes("allowfullscreen") ||
      /https:\/\/itch\.io\/embed-upload\//i.test(src);

    if (isGameIframe && isSafeItchioFrameUrl(src)) {
      return { directUrl: undefined, embedUrl: /^https:\/\/itch\.io\/embed-upload\//i.test(src) ? src : undefined };
    }
  }

  return { directUrl: undefined, embedUrl: undefined };
}

function extractItchioEmbeddedFrameCandidate(html: string) {
  const dataIframeMatches = html.matchAll(/\bdata-iframe="([^"]+)"/gi);

  for (const match of dataIframeMatches) {
    const decodedIframe = decodeHtmlAttribute(match[1] ?? "");
    const iframeSrc = decodedIframe.match(/<iframe\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    const normalizedSrc = iframeSrc ? decodeHtmlAttribute(iframeSrc) : "";
    const directUrl = normalizedSrc ? toItchioPlayableUrl(normalizedSrc) : undefined;
    const embedUrl = normalizedSrc ? toItchioEmbedUploadUrl(normalizedSrc) : undefined;
    if (directUrl || embedUrl) return { directUrl, embedUrl };
  }

  const normalizedHtml = decodeHtmlAttribute(html);
  return {
    directUrl: toItchioPlayableUrl(normalizedHtml),
    embedUrl: toItchioEmbedUploadUrl(normalizedHtml),
  };
}

async function chooseItchioPlayableUrl(candidate: { directUrl?: string; embedUrl?: string }, requestedMode: "embed" | "direct") {
  if (requestedMode === "embed" && candidate.embedUrl) {
    return { url: candidate.embedUrl, mode: "embed" as const };
  }

  if (candidate.directUrl) {
    if (requestedMode === "direct") return { url: candidate.directUrl, mode: "direct" as const };

    const directStatus = await inspectItchioDirectUrl(candidate.directUrl);
    if (directStatus.ok && !candidate.embedUrl) return { url: candidate.directUrl, mode: "direct" as const };
  }

  if (candidate.embedUrl) {
    return { url: candidate.embedUrl, mode: "embed" as const };
  }

  return undefined;
}

async function inspectItchioDirectUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "Mozilla/5.0 AIQ/1.0 itch.io app player",
        accept: "text/html,application/xhtml+xml",
        referer: "https://aiquan.me/",
      },
      cache: "no-store",
    });

    if (!response.ok) return { ok: false };

    const html = await response.text();
    const blockedByHotlink =
      response.url.includes("/embed-hotlink/") ||
      html.includes("You should be using itch.io") ||
      html.includes("tried to steal or hotlink it") ||
      html.includes("Play on itch.io");

    return { ok: !blockedByHotlink };
  } catch {
    return { ok: false };
  }
}

function isSafeItchioFrameUrl(value: string) {
  return (
    /^https:\/\/itch\.io\/embed-upload\//i.test(value) ||
    /^https:\/\/[^/]+\.itch\.io\//i.test(value) ||
    /^https:\/\/[^/]+\.itch\.zone\/html\//i.test(value)
  );
}

function toItchioPlayableUrl(value: string) {
  const directUrl = value.match(/https:\/\/[^/]+\.itch\.zone\/html\/\d+\/[^"'<>\\\s]+/i)?.[0];
  if (directUrl) return directUrl;

  const uploadId = value.match(/https:\/\/[^/]+\.itch\.zone\/html\/(\d+)(?:[-/])/i)?.[1];
  return uploadId ? `https://html-classic.itch.zone/html/${uploadId}/index.html` : undefined;
}

function toItchioEmbedUploadUrl(value: string) {
  const uploadId = value.match(/https:\/\/[^/]+\.itch\.zone\/html\/(\d+)(?:[-/])/i)?.[1];
  if (uploadId) return `https://itch.io/embed-upload/${uploadId}?color=191919`;

  const embedMatch = value.match(/https:\/\/itch\.io\/embed-upload\/\d+(?:\?[^"'<>\\\s]*)?/i)?.[0];
  return embedMatch;
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
