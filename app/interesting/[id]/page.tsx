import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Github,
  Heart,
  MessageCircle,
  Play,
  Star,
} from "lucide-react";

import { CopyPromptButton } from "@/components/copy-prompt-button";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  getWorkTypeLabel,
  interestingWorks,
  getRelatedInterestingWorks,
  type WorkItem,
  workSourceLabels,
} from "@/lib/interesting-works";
import { buildInterestingSkillWorks } from "@/lib/interesting-skill-works";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { mockPosts } from "@/lib/mock-data";
import { readGeneratedWorks } from "@/lib/generated-works-store";
import {
  absoluteUrl,
  buildWorkJsonLd,
  clipSeoText,
  JsonLdScript,
  seoTitle,
} from "@/lib/seo";
import { triggerWorksRebuild } from "@/lib/works-rebuild";
import { cn, formatCompactNumber, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const work = await findInterestingWork(id);

  if (!work) {
    return {
      title: seoTitle("作品未找到"),
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = clipSeoText(work.description || work.whyInteresting);
  const url = absoluteUrl(`/interesting/${work.id}`);

  return {
    title: seoTitle(work.title),
    description,
    alternates: {
      canonical: url,
    },
    keywords: work.tags,
    openGraph: {
      type: "article",
      url,
      title: work.title,
      description,
      siteName: "AI圈",
      publishedTime: work.publishedAt || work.createdAt,
      modifiedTime: work.publishedAt || work.createdAt,
      images: [
        {
          url: absoluteUrl(work.coverUrl),
          alt: work.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: work.title,
      description,
      images: [absoluteUrl(work.coverUrl)],
    },
  };
}

export default async function InterestingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let worksFeed = await readGeneratedWorks({ allowFallback: false });
  const generatedFeed = await readGeneratedFeed({ includeSkills: true, allowFallback: false });

  if (worksFeed.works.length === 0) {
    await waitForWorksRebuild(`interesting-detail:${id}`);
    worksFeed = await readGeneratedWorks({ allowFallback: false });
  }

  const skillWorks = buildInterestingSkillWorks([...generatedFeed.posts, ...mockPosts]);
  const allWorks = mergeInterestingWorks([...skillWorks, ...worksFeed.works, ...interestingWorks]);
  const work = allWorks.find((item) => item.id === id);

  if (!work) notFound();

  const relatedWorks = getRelatedInterestingWorks(work, 3, allWorks);
  const primaryUrl =
    work.source === "itchio"
      ? `/interesting/${work.id}/play`
      : work.source === "liblib"
      ? work.externalUrl || work.videoUrl || work.githubUrl
      : work.externalUrl || work.videoUrl || work.githubUrl;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <JsonLdScript data={buildWorkJsonLd(work)} />
      <Link
        href="/interesting"
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-soft transition-colors hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        回到有点意思
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <main className="min-w-0 space-y-4">
          <Card className="overflow-hidden rounded-[2rem] bg-white/95 p-0">
            <div className="relative h-[210px] overflow-hidden bg-slate-100 sm:h-[260px] lg:h-[300px]">
              <img
                src={work.coverUrl}
                alt={work.title}
                className="h-full w-full object-cover"
              />
              {work.type === "video" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  {primaryUrl ? (
                    <a
                      href={primaryUrl}
                      aria-label="观看作品"
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lift transition-transform hover:scale-105"
                    >
                      <Play className="h-7 w-7 fill-current" />
                    </a>
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lift">
                      <Play className="h-7 w-7 fill-current" />
                    </span>
                  )}
                </div>
              ) : null}
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                  {getWorkTypeLabel(work)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                  {workSourceLabels[work.source]}
                </span>
                {work.sourceVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    来源已核验
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                {work.title}
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{work.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-400">
                <span>{work.authorName ?? "匿名作者"}</span>
                <span>·</span>
                <span>{formatRelativeTime(work.publishedAt ?? work.createdAt)}</span>
                <span>·</span>
                <span>{formatCompactNumber(work.viewCount)} 次查看</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {primaryUrl ? (
                  <a
                    href={primaryUrl}
                    className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}
                  >
                    {work.categoryHint === "skill"
                      ? "查看 Skill"
                      : work.source === "itchio"
                      ? "直接试玩"
                      : work.categoryHint === "game"
                        ? "开始体验"
                      : work.source === "youtube" || work.source === "vimeo" || work.source === "liblib"
                        ? "观看作品"
                        : "查看作品"}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
                {work.githubUrl ? (
                  <a
                    href={work.githubUrl}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    <Github className="h-4 w-4" />
                    查看源码
                  </a>
                ) : null}
                {work.apkUrl ? (
                  <a
                    href={work.apkUrl}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    下载 APK
                  </a>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="rounded-[2rem] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Star className="h-5 w-5 text-amber-500" />
              {work.categoryHint === "skill" ? "这个 Skill 是做什么的" : "为什么有意思"}
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {work.whyInteresting}
            </p>
          </Card>

          {work.prompt ? (
            <Card className="rounded-[2rem] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">Prompt</h2>
                <CopyPromptButton prompt={work.prompt} />
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-3xl bg-slate-950 p-4 text-sm leading-7 text-slate-100">
                {work.prompt}
              </pre>
            </Card>
          ) : null}

          {work.workflowSteps?.length ? (
            <Card className="rounded-[2rem] p-5 sm:p-7">
              <h2 className="text-lg font-black text-slate-950">工作流步骤</h2>
              <div className="mt-4 grid gap-3">
                {work.workflowSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-3xl bg-slate-50 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold leading-7 text-slate-600">{step}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-[2rem] p-5">
            <h2 className="text-lg font-black text-slate-950">
              {work.categoryHint === "skill" ? "Skill 信息" : "作品信息"}
            </h2>
            <div className="mt-4 grid gap-3 text-sm">
              <InfoRow label="作者" value={work.authorName ?? "匿名作者"} />
              <InfoRow label="来源" value={workSourceLabels[work.source]} />
              <InfoRow label="类型" value={getWorkTypeLabel(work)} />
              <InfoRow label="热度" value={`${work.heatScore}`} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat icon={Heart} label="喜欢" value={work.likeCount} />
              <Stat icon={Star} label="收藏" value={work.favoriteCount} />
              <Stat icon={MessageCircle} label="评论" value={work.commentCount} />
            </div>
          </Card>

          {work.toolNames?.length ? (
            <Card className="rounded-[2rem] p-5">
              <h2 className="text-lg font-black text-slate-950">使用工具</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {work.toolNames.map((tool) => (
                  <span key={tool} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                    {tool}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="rounded-[2rem] p-5">
            <h2 className="text-lg font-black text-slate-950">标签</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {work.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                  #{tag}
                </span>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      {relatedWorks.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-2xl font-black text-slate-950">相关推荐</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedWorks.map((item) => (
              <Link key={item.id} href={`/interesting/${item.id}`}>
                <Card className="overflow-hidden rounded-[1.7rem] p-0 transition-transform hover:-translate-y-1 hover:shadow-lift">
                  <img src={item.coverUrl} alt={item.title} className="aspect-video w-full object-cover" />
                  <div className="p-4">
                    <div className="text-xs font-black text-blue-700">{getWorkTypeLabel(item)}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-black leading-6 text-slate-950">
                      {item.title}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

async function findInterestingWork(id: string) {
  const [worksFeed, generatedFeed] = await Promise.all([
    readGeneratedWorks({ allowFallback: true }),
    readGeneratedFeed({ includeSkills: true, allowFallback: true }),
  ]);
  const skillWorks = buildInterestingSkillWorks([...generatedFeed.posts, ...mockPosts]);
  return mergeInterestingWorks([...skillWorks, ...worksFeed.works, ...interestingWorks]).find(
    (item) => item.id === id,
  );
}

function mergeInterestingWorks(works: WorkItem[]) {
  const merged = new Map<string, WorkItem>();

  for (const work of works) {
    const key = work.externalUrl || work.githubUrl || work.videoUrl || work.id;
    if (!merged.has(key)) {
      merged.set(key, work);
    }
  }

  return Array.from(merged.values());
}

async function waitForWorksRebuild(reason: string) {
  try {
    await Promise.race([
      triggerWorksRebuild(reason),
      new Promise((resolve) => setTimeout(resolve, 60_000)),
    ]);
  } catch (error) {
    console.error("[interesting-detail] works rebuild failed", error);
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className="text-right font-black text-slate-800">{value}</span>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2 py-3">
      <Icon className="mx-auto h-4 w-4 text-blue-600" />
      <div className="mt-1 text-sm font-black text-slate-950">{formatCompactNumber(value)}</div>
      <div className="text-[10px] font-bold text-slate-400">{label}</div>
    </div>
  );
}
