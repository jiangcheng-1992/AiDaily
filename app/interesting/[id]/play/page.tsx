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

  const playUrl = await resolveItchioPlayUrl(work.externalUrl);
  const frameUrl = playUrl ?? work.externalUrl;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
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

      <Card className="overflow-hidden rounded-[2rem] bg-slate-950 p-0 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              <Gamepad2 className="h-3.5 w-3.5" />
              App 内试玩
            </div>
            <h1 className="mt-2 line-clamp-1 text-lg font-black sm:text-xl">{work.title}</h1>
          </div>
          <Link
            href={`/interesting/${work.id}/play?refresh=${Date.now()}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </Link>
        </div>

        <div className="relative h-[calc(100vh-11rem)] min-h-[520px] bg-black">
          <iframe
            src={frameUrl}
            title={work.title}
            allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write"
            allowFullScreen
            loading="eager"
            className="h-full w-full border-0 bg-black"
          />
        </div>
      </Card>

      {!playUrl ? (
        <Card className="mt-4 rounded-3xl p-5">
          <p className="text-sm leading-7 text-slate-600">
            这个游戏没有解析到 itch.io 的直接运行地址，已在 App 内加载原页面。若页面提示登录、弹窗或无法开始，请点击“打开 itch.io 原页”继续。
          </p>
        </Card>
      ) : null}
    </div>
  );
}

async function resolveItchioPlayUrl(gameUrl: string) {
  try {
    const response = await fetch(gameUrl, {
      headers: {
        "user-agent": process.env.AIQ_USER_AGENT ?? "AIQ/1.0 itch.io app player",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return undefined;

    const html = await response.text();
    const rawPlayUrl = html.match(/"play_url":"([^"]+)"/)?.[1];
    if (!rawPlayUrl) return undefined;

    const playUrl = decodeJsonString(rawPlayUrl);
    return /^https:\/\/[^/]+\.itch\.io\/.+\/rp\//i.test(playUrl) ? playUrl : undefined;
  } catch {
    return undefined;
  }
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
  }
}
