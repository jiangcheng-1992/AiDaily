import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { autoIngestSourceIds, extractGeneratedSourceId } from "@/lib/ai-sources";
import { autoIngestDouyinSourceIds } from "@/lib/douyin-video-sources";
import type { Comment, Post } from "@/lib/mock-data";

export type GeneratedFeed = {
  policyVersion?: string;
  updatedAt?: string;
  posts: Post[];
  comments: Record<string, Comment[]>;
};

type ReadGeneratedFeedOptions = {
  includeSkills?: boolean;
};

export const GENERATED_FEED_POLICY_VERSION = "2026-05-core-sources-v1";

const emptyFeed: GeneratedFeed = {
  policyVersion: GENERATED_FEED_POLICY_VERSION,
  posts: [],
  comments: {},
};

export function getGeneratedFeedPath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "generated-feed.json");
}

export async function readGeneratedFeed(
  options: ReadGeneratedFeedOptions = {},
): Promise<GeneratedFeed> {
  const filePath = getGeneratedFeedPath();

  if (!existsSync(filePath)) return emptyFeed;

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as GeneratedFeed;
    if (parsed.policyVersion !== GENERATED_FEED_POLICY_VERSION) {
      return emptyFeed;
    }

    return sanitizeGeneratedFeed({
      policyVersion: parsed.policyVersion,
      updatedAt: parsed.updatedAt,
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments:
        parsed.comments && typeof parsed.comments === "object"
          ? parsed.comments
          : {},
    }, options);
  } catch {
    return emptyFeed;
  }
}

export async function writeGeneratedFeed(feed: GeneratedFeed) {
  const filePath = getGeneratedFeedPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(sanitizeGeneratedFeed(feed, { includeSkills: true }), null, 2),
    "utf8",
  );
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

  for (const post of current.posts) postMap.set(post.id, post);
  for (const post of incomingPosts) postMap.set(post.id, post);

  const posts = Array.from(postMap.values())
    .sort(
      (a, b) =>
        new Date(b.collectedAt ?? b.createdAt).getTime() -
        new Date(a.collectedAt ?? a.createdAt).getTime(),
    )
    .slice(0, limit);
  const postIds = new Set(posts.map((post) => post.id));
  const comments: Record<string, Comment[]> = {};

  for (const post of posts) {
    const mergedComments = [
      ...(current.comments[post.id] ?? []),
      ...(incomingComments[post.id] ?? []),
    ];
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

function sanitizeGeneratedFeed(
  feed: GeneratedFeed,
  options: ReadGeneratedFeedOptions = {},
): GeneratedFeed {
  const posts = feed.posts.filter((post) => shouldKeepGeneratedPost(post, options));
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

function shouldKeepGeneratedPost(post: Post, options: ReadGeneratedFeedOptions) {
  if (post.type === "skill") return options.includeSkills === true;

  const sourceId = post.sourceId ?? extractGeneratedSourceId(post.id);
  if (!sourceId) return true;

  return autoIngestSourceIds.has(sourceId) || autoIngestDouyinSourceIds.has(sourceId);
}
