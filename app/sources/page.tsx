import Link from "next/link";
import { DatabaseZap, ExternalLink, Radio, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  authoritativeSources,
  autoIngestSources,
  fetchableSources,
} from "@/lib/ai-sources";

const authorityLabels = {
  official: "官方",
  research: "研究",
  media: "媒体",
  community: "社区",
  product: "产品",
};

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <Radio className="h-4 w-4" />
          信息源雷达
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
          权威 AI 信息源库
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          现在采用分层抓取策略。第一层是核心自动抓取源，只保留少量权威站点并叠加时间窗、关键词降噪；第二层是监控位，先收录但暂不自动入库，等解析器完善后再放开。
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="已收录来源" value={authoritativeSources.length} icon={ShieldCheck} />
        <MetricCard label="可直接抓取" value={fetchableSources.length} icon={DatabaseZap} />
        <MetricCard label="自动白名单" value={autoIngestSources.length} icon={Radio} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {authoritativeSources.map((source) => (
          <Card key={source.id} className="rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                    {authorityLabels[source.authority]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {source.fetchType.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {source.status === "ready" ? "可抓取" : "待解析"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      source.autoIngest
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {source.autoIngest ? "自动抓取" : "仅监控"}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-black leading-6 text-slate-950">
                  {source.name}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                {source.reliabilityScore}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{source.notes}</p>
            {source.autoIngest && source.maxItemAgeDays ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                仅抓取最近 {source.maxItemAgeDays} 天内的更新
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {source.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-semibold text-slate-400">
                {source.cadence === "daily"
                  ? "每日检查"
                  : source.cadence === "hourly"
                    ? "每小时检查"
                    : "每周检查"}
              </span>
              <Link
                href={source.homeUrl}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
              >
                查看来源
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof ShieldCheck;
}) {
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-black text-slate-950">{value}</div>
          <div className="text-sm font-semibold text-slate-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}
