"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { generateAiCommentsForPost } from "@/lib/ai-comment-roles";
import {
  type Comment,
  type Post,
  type PostType,
  mockComments,
  mockPosts,
} from "@/lib/mock-data";
import { normalizeTags } from "@/lib/utils";

const keys = {
  likedPosts: "aiq.likedPosts",
  savedPosts: "aiq.savedPosts",
  comments: "aiq.comments",
  submissions: "aiq.submissions",
  likedComments: "aiq.likedComments",
};

type LocalState = {
  likedPosts: string[];
  savedPosts: string[];
  comments: Record<string, Comment[]>;
  submissions: Post[];
  likedComments: string[];
};

const emptyState: LocalState = {
  likedPosts: [],
  savedPosts: [],
  comments: {},
  submissions: [],
  likedComments: [],
};

let lastSerialized = "";
let lastSnapshot: LocalState = emptyState;

export type SubmissionInput = {
  title: string;
  type: PostType;
  sourceUrl?: string;
  summary: string;
  whyItMatters: string;
  tags: string;
  author: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readLocalState(): LocalState {
  if (typeof window === "undefined") return emptyState;

  const snapshot: LocalState = {
    likedPosts: readJson<string[]>(keys.likedPosts, []),
    savedPosts: readJson<string[]>(keys.savedPosts, []),
    comments: readJson<Record<string, Comment[]>>(keys.comments, {}),
    submissions: readJson<Post[]>(keys.submissions, []),
    likedComments: readJson<string[]>(keys.likedComments, []),
  };
  const serialized = JSON.stringify(snapshot);

  if (serialized === lastSerialized) {
    return lastSnapshot;
  }

  lastSerialized = serialized;
  lastSnapshot = snapshot;
  return snapshot;
}

function writeLocalState(next: LocalState) {
  writeJson(keys.likedPosts, next.likedPosts);
  writeJson(keys.savedPosts, next.savedPosts);
  writeJson(keys.comments, next.comments);
  writeJson(keys.submissions, next.submissions);
  writeJson(keys.likedComments, next.likedComments);

  lastSnapshot = next;
  lastSerialized = JSON.stringify(next);
  window.dispatchEvent(new Event("aiq-store-change"));
}

function subscribeToLocalState(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("aiq-store-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("aiq-store-change", onStoreChange);
  };
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useAiCircleStore() {
  const localState = useSyncExternalStore(
    subscribeToLocalState,
    readLocalState,
    () => emptyState,
  );
  const { likedPosts, savedPosts, comments, submissions, likedComments } =
    localState;

  const allPosts = useMemo(() => [...submissions, ...mockPosts], [submissions]);

  const getPostStats = useCallback(
    (post: Post) => {
      const localComments = comments[post.id]?.length ?? 0;
      const liked = likedPosts.includes(post.id);
      const saved = savedPosts.includes(post.id);

      return {
        liked,
        saved,
        likesCount: post.likesCount + (liked ? 1 : 0),
        savesCount: post.savesCount + (saved ? 1 : 0),
        commentsCount: post.commentsCount + localComments,
      };
    },
    [comments, likedPosts, savedPosts],
  );

  const getCommentsForPost = useCallback(
    (postId: string) => [
      ...(mockComments[postId] ?? []),
      ...(comments[postId] ?? []),
    ],
    [comments],
  );

  const toggleLike = useCallback((postId: string) => {
    const current = readLocalState();
    const nextLikedPosts = current.likedPosts.includes(postId)
      ? current.likedPosts.filter((id) => id !== postId)
      : [...current.likedPosts, postId];

    writeLocalState({ ...current, likedPosts: nextLikedPosts });
  }, []);

  const toggleSave = useCallback((postId: string) => {
    const current = readLocalState();
    const nextSavedPosts = current.savedPosts.includes(postId)
      ? current.savedPosts.filter((id) => id !== postId)
      : [...current.savedPosts, postId];

    writeLocalState({ ...current, savedPosts: nextSavedPosts });
  }, []);

  const addComment = useCallback((postId: string, content: string) => {
    const cleanContent = content.trim();
    if (!cleanContent) return null;

    const newComment: Comment = {
      id: createId("comment"),
      postId,
      author: "AI 探索者",
      content: cleanContent,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      avatarText: "探",
    };

    const current = readLocalState();
    writeLocalState({
      ...current,
      comments: {
        ...current.comments,
        [postId]: [...(current.comments[postId] ?? []), newComment],
      },
    });

    return newComment;
  }, []);

  const addAiComments = useCallback((post: Post) => {
    const current = readLocalState();
    const localComments = current.comments[post.id] ?? [];
    const existingRoleIds = localComments
      .map((comment) => comment.roleId)
      .filter((roleId): roleId is string => Boolean(roleId));
    const generatedComments = generateAiCommentsForPost(post, existingRoleIds);

    if (!generatedComments.length) return [];

    writeLocalState({
      ...current,
      comments: {
        ...current.comments,
        [post.id]: [...localComments, ...generatedComments],
      },
    });

    return generatedComments;
  }, []);

  const addGeneratedComments = useCallback((postId: string, generated: Comment[]) => {
    if (!generated.length) return [];

    const current = readLocalState();
    const localComments = current.comments[postId] ?? [];
    const existingIds = new Set(localComments.map((comment) => comment.id));
    const nextComments = generated.filter((comment) => !existingIds.has(comment.id));

    if (!nextComments.length) return [];

    writeLocalState({
      ...current,
      comments: {
        ...current.comments,
        [postId]: [...localComments, ...nextComments],
      },
    });

    return nextComments;
  }, []);

  const toggleCommentLike = useCallback((commentId: string) => {
    const current = readLocalState();
    const nextLikedComments = current.likedComments.includes(commentId)
      ? current.likedComments.filter((id) => id !== commentId)
      : [...current.likedComments, commentId];

    writeLocalState({ ...current, likedComments: nextLikedComments });
  }, []);

  const addSubmission = useCallback((input: SubmissionInput) => {
    const tags = normalizeTags(input.tags);
    const post: Post = {
      id: createId("submission"),
      type: input.type,
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: `${input.summary.trim()}\n\n这是一条来自社区成员的投稿，当前保存在本地浏览器中。后续接入真实后端后，它可以进入审核、推荐和榜单流转。`,
      whyItMatters: input.whyItMatters.trim(),
      editorComment:
        "社区投稿已进入本地信息流。建议补充原始来源、截图或数据证据，让内容更容易被读者信任。",
      sourceName: input.sourceUrl ? "社区投稿" : "AI圈社区",
      sourceUrl: input.sourceUrl?.trim() || undefined,
      author: input.author.trim() || "匿名投稿人",
      tags: tags.length ? tags : ["社区投稿"],
      createdAt: new Date().toISOString(),
      likesCount: 0,
      commentsCount: 0,
      savesCount: 0,
    };

    const current = readLocalState();
    writeLocalState({ ...current, submissions: [post, ...current.submissions] });

    return post;
  }, []);

  return {
    hydrated: true,
    allPosts,
    savedPostIds: savedPosts,
    likedCommentIds: likedComments,
    commentsByPost: comments,
    submissions,
    getPostStats,
    getCommentsForPost,
    toggleLike,
    toggleSave,
    addComment,
    addAiComments,
    addGeneratedComments,
    toggleCommentLike,
    addSubmission,
  };
}
