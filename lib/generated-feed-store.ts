import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Comment, Post } from "@/lib/mock-data";

export type GeneratedFeed = {
  updatedAt?: string;
  posts: Post[];
  comments: Record<string, Comment[]>;
};

const emptyFeed: GeneratedFeed = {
  posts: [],
  comments: {},
};

export function getGeneratedFeedPath() {
  const dataDir = process.env.AIQ_DATA_DIR || join(process.cwd(), "data");
  return join(dataDir, "generated-feed.json");
}

export async function readGeneratedFeed(): Promise<GeneratedFeed> {
  const filePath = getGeneratedFeedPath();

  if (!existsSync(filePath)) return emptyFeed;

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as GeneratedFeed;

    return {
      updatedAt: parsed.updatedAt,
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments:
        parsed.comments && typeof parsed.comments === "object"
          ? parsed.comments
          : {},
    };
  } catch {
    return emptyFeed;
  }
}

export async function writeGeneratedFeed(feed: GeneratedFeed) {
  const filePath = getGeneratedFeedPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(feed, null, 2), "utf8");
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
    updatedAt: new Date().toISOString(),
    posts,
    comments: Object.fromEntries(
      Object.entries(comments).filter(([postId]) => postIds.has(postId)),
    ),
  };
}
