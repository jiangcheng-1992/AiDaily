import { createHash } from "node:crypto";

import type { Post } from "@/lib/mock-data";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "f",
  "from",
  "source",
  "spm",
  "timestamp",
  "ts",
  "mid",
  "u_code",
  "iid",
  "did",
  "with_sec_did",
  "titleType",
  "share_sign",
  "share_version",
  "share_app_id",
  "share_token",
  "share_track_info",
  "from_aid",
  "from_ssr",
  "sec_user_id",
  "sec_uid",
  "social_share_type",
  "region",
  "app",
  "enter_from",
]);

export function buildGeneratedPostId({
  sourceId,
  sourceUrl,
  title,
  type,
}: {
  sourceId: string;
  sourceUrl?: string;
  title?: string;
  type?: Post["type"];
}) {
  const identity = buildPostIdentityValue({ sourceUrl, title, type });
  return `source-${sourceId}-${hashText(identity)}`;
}

export function buildGeneratedPostIdentityKey({
  sourceId,
  sourceUrl,
  title,
  type,
}: {
  sourceId?: string;
  sourceUrl?: string;
  title?: string;
  type?: Post["type"];
}) {
  const identity = buildPostIdentityValue({ sourceUrl, title, type });
  return `${sourceId ?? "unknown"}::${identity}`;
}

export function buildIdentityKeyFromPost(post: Post) {
  return buildGeneratedPostIdentityKey({
    sourceId: post.sourceId,
    sourceUrl: post.sourceUrl,
    title: post.title,
    type: post.type,
  });
}

function buildPostIdentityValue({
  sourceUrl,
  title,
  type,
}: {
  sourceUrl?: string;
  title?: string;
  type?: Post["type"];
}) {
  const normalizedUrl = normalizeIdentityUrl(sourceUrl);
  if (normalizedUrl) return normalizedUrl;

  const normalizedTitle = normalizeIdentityTitle(title);
  if (normalizedTitle) return `${type ?? "post"}:${normalizedTitle}`;

  return `${type ?? "post"}:unknown`;
}

function normalizeIdentityUrl(sourceUrl?: string) {
  if (!sourceUrl) return "";
  const trimmed = sourceUrl.trim();
  if (!trimmed) return "";

  const douyinVideoId = extractDouyinVideoId(trimmed);
  if (douyinVideoId) return `douyin:${douyinVideoId}`;

  try {
    const url = new URL(trimmed);
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (
        TRACKING_PARAMS.has(lowerKey) ||
        TRACKING_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))
      ) {
        url.searchParams.delete(key);
      }
    }

    const query = [...url.searchParams.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    return `${url.origin.toLowerCase()}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return trimmed.replace(/#.*$/, "").trim().toLowerCase();
  }
}

function normalizeIdentityTitle(title?: string) {
  return (title ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”"'`]/g, "")
    .toLowerCase();
}

function extractDouyinVideoId(value: string) {
  return value.match(/\/(?:share\/)?video\/(\d+)/)?.[1] ?? "";
}

function hashText(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}
