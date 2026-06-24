import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { mockComments, mockPosts } from "@/lib/mock-data";
import type { Comment, Post } from "@/lib/mock-data";
import { getPostPublishedSortTime } from "@/lib/feed-view";
import { isGeneratedPreviewImageUrl } from "@/lib/image-url";
import { buildIdentityKeyFromPost } from "@/lib/post-identity";

export type GeneratedFeed = {
  policyVersion?: string;
  updatedAt?: string;
  posts: Post[];
  comments: Record<string, Comment[]>;
};

type ReadGeneratedFeedOptions = {
  includeSkills?: boolean;
  allowFallback?: boolean;
};

export const GENERATED_FEED_POLICY_VERSION = "2026-05-core-sources-v1";

const emptyFeed: GeneratedFeed = {
  policyVersion: GENERATED_FEED_POLICY_VERSION,
  posts: [],
  comments: {},
};

const baselineFeed: GeneratedFeed = {
  policyVersion: GENERATED_FEED_POLICY_VERSION,
  updatedAt: "2026-05-16T00:00:00.000Z",
  posts: mockPosts,
  comments: mockComments,
};

export function getGeneratedFeedPath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "generated-feed.json");
}

export async function readGeneratedFeed(
  options: ReadGeneratedFeedOptions = {},
): Promise<GeneratedFeed> {
  const filePath = getGeneratedFeedPath();
  const allowFallback = shouldAllowGeneratedFeedFallback(options);

  if (!existsSync(filePath)) {
    return allowFallback ? buildFallbackFeed(options) : emptyFeed;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as GeneratedFeed;
    const normalizedFeed = {
      policyVersion: parsed.policyVersion,
      updatedAt: parsed.updatedAt,
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments:
        parsed.comments && typeof parsed.comments === "object"
          ? parsed.comments
          : {},
    };

    // Keep serving the last persisted feed during deploys even if the policy
    // version changed, otherwise the homepage can flash empty before the next
    // ingest finishes rewriting the file.
    const sanitizedFeed = sanitizeGeneratedFeed(normalizedFeed, options);
    return sanitizedFeed.posts.length > 0 || !allowFallback
      ? sanitizedFeed
      : buildFallbackFeed(options);
  } catch {
    return allowFallback ? buildFallbackFeed(options) : emptyFeed;
  }
}

export async function readGeneratedFeedStatus(
  options: Omit<ReadGeneratedFeedOptions, "allowFallback"> = {},
) {
  const filePath = getGeneratedFeedPath();
  const persistedFeed = await readGeneratedFeed({ ...options, allowFallback: false });

  return {
    filePath,
    exists: existsSync(filePath),
    hasPersistedPosts: persistedFeed.posts.length > 0,
    persistedPostCount: persistedFeed.posts.length,
    fallbackActive: persistedFeed.posts.length === 0,
  };
}

export async function writeGeneratedFeed(feed: GeneratedFeed) {
  const filePath = getGeneratedFeedPath();
  const nextFeed = sanitizeGeneratedFeed(feed, { includeSkills: true });

  if (nextFeed.posts.length === 0 && existsSync(filePath)) {
    try {
      const current = JSON.parse(await readFile(filePath, "utf8")) as GeneratedFeed;
      if (Array.isArray(current.posts) && current.posts.length > 0) {
        throw new Error(
          `Refusing to overwrite existing feed with empty feed at ${filePath}`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) {
        throw error;
      }
    }
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nextFeed, null, 2), "utf8");
}

export function mergeGeneratedFeed({
  current,
  incomingPosts,
  incomingComments,
  limit = 120,
}: {
  current: GeneratedFeed;
  incomingPosts: Post[];
  incomingComments: Record<string, Comment[]>;
  limit?: number;
}): GeneratedFeed {
  const postMap = new Map<string, Post>();
  const postIdentityMap = new Map<string, string>();

  for (const post of current.posts) {
    postMap.set(post.id, post);
    postIdentityMap.set(post.id, buildIdentityKeyFromPost(post));
  }
  for (const post of incomingPosts) {
    const existing = postMap.get(post.id);
    const mergedPost = mergePosts(existing, post);
    postMap.set(post.id, mergedPost);
    postIdentityMap.set(post.id, buildIdentityKeyFromPost(mergedPost));
  }

  const dedupedPosts = new Map<string, Post>();
  const identityAliases = new Map<string, Set<string>>();
  for (const post of postMap.values()) {
    const identityKey = postIdentityMap.get(post.id) ?? buildIdentityKeyFromPost(post);
    const existing = dedupedPosts.get(identityKey);
    const mergedPost = mergePosts(existing, post);
    dedupedPosts.set(identityKey, mergedPost);

    if (!identityAliases.has(identityKey)) {
      identityAliases.set(identityKey, new Set<string>());
    }
    identityAliases.get(identityKey)?.add(post.id);
    identityAliases.get(identityKey)?.add(mergedPost.id);
  }

  const posts = Array.from(dedupedPosts.values())
    .sort(
      (a, b) =>
        getPostPublishedSortTime(b) - getPostPublishedSortTime(a),
    )
    .slice(0, limit);
  const postIds = new Set(posts.map((post) => post.id));
  const comments: Record<string, Comment[]> = {};

  for (const post of posts) {
    const identityKey = buildIdentityKeyFromPost(post);
    const aliasIds = identityAliases.get(identityKey) ?? new Set([post.id]);
    const mergedComments = Array.from(aliasIds).flatMap((postId) => [
      ...(current.comments[postId] ?? []),
      ...(incomingComments[postId] ?? []),
    ]);
    const seen = new Set<string>();

    comments[post.id] = mergedComments.filter((comment) => {
      if (seen.has(comment.id)) return false;
      seen.add(comment.id);
      return true;
    });
  }

  return {
    policyVersion: GENERATED_FEED_POLICY_VERSION,
    updatedAt: new Date().toISOString(),
    posts,
    comments: Object.fromEntries(
      Object.entries(comments).filter(([postId]) => postIds.has(postId)),
    ),
  };
}

function mergePosts(existing: Post | undefined, incoming: Post) {
  if (!existing) return incoming;

  const earliestCollectedAt = pickEarlierDate(existing.collectedAt, incoming.collectedAt);
  const earliestCreatedAt = pickEarlierDate(existing.createdAt, incoming.createdAt);

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    createdAt: earliestCreatedAt ?? incoming.createdAt ?? existing.createdAt,
    collectedAt: earliestCollectedAt ?? incoming.collectedAt ?? existing.collectedAt,
    likesCount: Math.max(existing.likesCount ?? 0, incoming.likesCount ?? 0),
    commentsCount: Math.max(existing.commentsCount ?? 0, incoming.commentsCount ?? 0),
    savesCount: Math.max(existing.savesCount ?? 0, incoming.savesCount ?? 0),
  };
}

function pickEarlierDate(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;

  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function sanitizeGeneratedFeed(
  feed: GeneratedFeed,
  options: ReadGeneratedFeedOptions = {},
): GeneratedFeed {
  const posts = dedupePostsByIdentity(
    feed.posts.filter((post) => shouldKeepGeneratedPost(post, options)).map(stripGeneratedPreviewImages),
  );
  const postIds = new Set(posts.map((post) => post.id));

  return {
    policyVersion: GENERATED_FEED_POLICY_VERSION,
    updatedAt: feed.updatedAt,
    posts,
    comments: Object.fromEntries(
      Object.entries(feed.comments).filter(([postId]) => postIds.has(postId)),
    ),
  };
}

function dedupePostsByIdentity(posts: Post[]) {
  const deduped = new Map<string, Post>();

  for (const post of posts) {
    const identityKey = buildIdentityKeyFromPost(post);
    deduped.set(identityKey, mergePosts(deduped.get(identityKey), post));
  }

  return Array.from(deduped.values()).sort(
    (a, b) => getPostPublishedSortTime(b) - getPostPublishedSortTime(a),
  );
}

function shouldKeepGeneratedPost(post: Post, options: ReadGeneratedFeedOptions) {
  if (post.type === "skill") return options.includeSkills === true;
  return true;
}

function stripGeneratedPreviewImages(post: Post): Post {
  const imageUrls = post.imageUrls?.filter((url) => !isGeneratedPreviewImageUrl(url));
  const contentBlocks = post.contentBlocks?.filter(
    (block) => block.type !== "image" || !isGeneratedPreviewImageUrl(block.url),
  );

  return {
    ...post,
    coverImageUrl: isGeneratedPreviewImageUrl(post.coverImageUrl) ? undefined : post.coverImageUrl,
    imageUrls,
    contentBlocks,
  };
}

function buildFallbackFeed(options: ReadGeneratedFeedOptions = {}) {
  return sanitizeGeneratedFeed(baselineFeed, options);
}

function shouldAllowGeneratedFeedFallback(options: ReadGeneratedFeedOptions) {
  if (typeof options.allowFallback === "boolean") return options.allowFallback;
  return process.env.NODE_ENV !== "production";
}
