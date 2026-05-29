import type { Metadata } from "next";

import { PostDetailClient } from "@/components/post-detail-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { getPostById, mockPosts } from "@/lib/mock-data";
import {
  absoluteUrl,
  buildPostJsonLd,
  clipSeoText,
  getPostSeoImage,
  JsonLdScript,
  seoTitle,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await findPostById(id);

  if (!post) {
    return {
      title: seoTitle("内容未找到"),
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = clipSeoText(post.summary || post.whyItMatters || post.content);
  const image = getPostSeoImage(post);
  const url = absoluteUrl(`/post/${post.id}`);

  return {
    title: seoTitle(post.title),
    description,
    alternates: {
      canonical: url,
    },
    keywords: post.tags,
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description,
      siteName: "AI圈",
      publishedTime: post.createdAt,
      modifiedTime: post.collectedAt || post.createdAt,
      authors: [post.author || post.sourceName || "AI圈编辑部"],
      tags: post.tags,
      images: image
        ? [
            {
              url: absoluteUrl(image),
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: image ? [absoluteUrl(image)] : undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const generatedFeed = await readGeneratedFeed({ includeSkills: id.startsWith("github-") });
  const allServerPosts = [...generatedFeed.posts, ...mockPosts];
  const initialPost = getPostById(allServerPosts, id);
  const initialComments = generatedFeed.comments[id] ?? [];

  return (
    <>
      {initialPost ? <JsonLdScript data={buildPostJsonLd(initialPost)} /> : null}
      <PostDetailClient
        postId={id}
        initialPost={initialPost}
        initialComments={initialComments}
      />
    </>
  );
}

async function findPostById(id: string) {
  const generatedFeed = await readGeneratedFeed({ includeSkills: true });
  return getPostById([...generatedFeed.posts, ...mockPosts], id);
}
