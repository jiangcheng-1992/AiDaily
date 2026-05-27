"use client";

import { useEffect } from "react";

import { ADSENSE_CLIENT, shouldRenderGoogleAd } from "@/lib/google-ads";
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

export function GoogleAdSlot({
  slot,
  format = "auto",
  layout,
  layoutKey,
  className,
  previewLabel = "Google AdSense 广告预览位",
}: GoogleAdSlotProps) {
  const enabled = shouldRenderGoogleAd(slot);

  useEffect(() => {
    if (!enabled) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn("[adsense] ad slot render failed", error);
    }
  }, [enabled, slot]);

  if (!enabled) return null;

  return (
    <ins
      className={cn("adsbygoogle block", className)}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-ad-layout-key={layoutKey}
      data-full-width-responsive="true"
    />
  );
}
