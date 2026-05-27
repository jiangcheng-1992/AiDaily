const referrerProtectedImageHosts = new Set(["i.qbitai.com", "www.qbitai.com"]);

export function isGeneratedPreviewImageUrl(src?: string | null) {
  return Boolean(src?.includes("copilot-cn.bytedance.net/api/ide/v1/text_to_image"));
}

export function getDisplayImageUrl(src?: string | null, referrerUrl?: string | null) {
  if (!src) return "";

  try {
    const imageUrl = new URL(src);
    if (imageUrl.protocol === "http:") imageUrl.protocol = "https:";

    if (!referrerProtectedImageHosts.has(imageUrl.hostname)) {
      return imageUrl.toString();
    }

    const params = new URLSearchParams({
      url: imageUrl.toString(),
    });
    if (referrerUrl) params.set("ref", referrerUrl);

    return `/api/image-proxy?${params.toString()}`;
  } catch {
    return src;
  }
}
