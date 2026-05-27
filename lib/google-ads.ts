const DEFAULT_ADSENSE_CLIENT = "ca-pub-6821198896914466";

export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || DEFAULT_ADSENSE_CLIENT;

export const GOOGLE_ADSENSE_ENABLED =
  (process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ENABLED ?? "false").toLowerCase() === "true";

export function shouldRenderGoogleAd(slot?: string) {
  return GOOGLE_ADSENSE_ENABLED && Boolean(ADSENSE_CLIENT && slot);
}
