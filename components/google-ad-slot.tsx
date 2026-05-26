"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type GoogleAdSlotProps = {
  slot?: string;
  format?: "auto" | "fluid";
  layout?: string;
  layoutKey?: string;
  className?: string;
  previewLabel?: string;
};

const DEFAULT_ADSENSE_CLIENT = "ca-pub-6821198896914466";
const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || DEFAULT_ADSENSE_CLIENT;

export function GoogleAdSlot({
  slot,
  format = "auto",
  layout,
  layoutKey,
  className,
  previewLabel = "Google AdSense 广告预览位",
}: GoogleAdSlotProps) {
  const enabled = Boolean(adsenseClient && slot);

  useEffect(() => {
    if (!enabled) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn("[adsense] ad slot render failed", error);
    }
  }, [enabled, slot]);

  if (!enabled) {
    return (
      <div
        className={cn(
          "flex min-h-[140px] items-center justify-center rounded-[1.4rem] border border-dashed border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/80 p-4 text-center",
          className,
        )}
      >
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">
            Ad Preview
          </div>
          <div className="mt-2 text-sm font-black text-slate-800">{previewLabel}</div>
          <div className="mt-1 text-xs font-medium leading-5 text-slate-400">
            配置广告 slot 后自动切换为真实广告
          </div>
        </div>
      </div>
    );
  }

  return (
    <ins
      className={cn("adsbygoogle block", className)}
      style={{ display: "block" }}
      data-ad-client={adsenseClient}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive="true"
    />
  );
}
