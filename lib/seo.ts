import type { Post } from "@/lib/mock-data";
import type { WorkItem } from "@/lib/interesting-works";
import { createElement } from "react";

export const CANONICAL_SITE_URL = "https://aiquan.me";
const DEFAULT_SITE_URL = CANONICAL_SITE_URL;
const SITE_NAME = "AI圈";
const LEGACY_SITE_HOSTS = new Set(["aidaily-production.up.railway.app"]);

export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL || DEFAULT_SITE_URL;
  const normalized = raw.replace(/\/+$/, "");

  try {
    const url = new URL(normalized);
    if (LEGACY_SITE_HOSTS.has(url.hostname.toLowerCase())) {
      return CANONICAL_SITE_URL;
    }
  } catch {
    return DEFAULT_SITE_URL;
  }

  return normalized;
}

export function getCanonicalSiteUrl() {
  return CANONICAL_SITE_URL;
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function canonicalUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getCanonicalSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function seoTitle(title: string) {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

export function clipSeoText(value: string | undefined, maxLength = 160) {
  const normalized = stripHtml(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function getPostSeoImage(post: Post) {
  return post.coverImageUrl || post.imageUrls?.[0];
}

export function buildPostJsonLd(post: Post) {
  const image = getPostSeoImage(post);

  return removeUndefinedValues({
    "@context": "https://schema.org",
    "@type": post.type === "video" ? "VideoObject" : "Article",
    headline: post.title,
    description: clipSeoText(post.summary || post.whyItMatters),
    image: image ? [absoluteUrl(image)] : undefined,
    datePublished: post.createdAt,
    dateModified: post.collectedAt || post.createdAt,
    author: {
      "@type": "Person",
      name: post.author || post.sourceName || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    mainEntityOfPage: absoluteUrl(`/post/${post.id}`),
    keywords: post.tags.join(", "),
    url: absoluteUrl(`/post/${post.id}`),
    contentUrl: post.videoUrl,
    embedUrl: post.videoEmbedUrl,
    thumbnailUrl: image ? absoluteUrl(image) : undefined,
    uploadDate: post.type === "video" ? post.createdAt : undefined,
  });
}

export function buildWorkJsonLd(work: WorkItem) {
  const type = work.type === "video" ? "VideoObject" : work.type === "app" ? "SoftwareApplication" : "CreativeWork";

  return removeUndefinedValues({
    "@context": "https://schema.org",
    "@type": type,
    name: work.title,
    headline: work.title,
    description: clipSeoText(work.description || work.whyInteresting),
    image: work.coverUrl ? [absoluteUrl(work.coverUrl)] : undefined,
    thumbnailUrl: work.coverUrl ? absoluteUrl(work.coverUrl) : undefined,
    datePublished: work.publishedAt || work.createdAt,
    dateModified: work.publishedAt || work.createdAt,
    author: work.authorName
      ? {
          "@type": "Person",
          name: work.authorName,
          url: work.originalAuthorUrl,
        }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    mainEntityOfPage: absoluteUrl(`/interesting/${work.id}`),
    url: absoluteUrl(`/interesting/${work.id}`),
    sameAs: [work.externalUrl, work.githubUrl, work.videoUrl].filter(Boolean),
    keywords: work.tags.join(", "),
    applicationCategory: type === "SoftwareApplication" ? "AIApplication" : undefined,
    contentUrl: work.videoUrl,
    embedUrl: work.videoUrl,
    uploadDate: type === "VideoObject" ? work.publishedAt || work.createdAt : undefined,
  });
}

export function JsonLdScript({ data }: { data: unknown }) {
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    },
  });
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function removeUndefinedValues(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    }),
  );
}
