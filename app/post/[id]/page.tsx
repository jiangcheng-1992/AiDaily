import { PostDetailClient } from "@/components/post-detail-client";
import { readGeneratedFeed } from "@/lib/generated-feed-store";
import { getPostById, mockPosts } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return mockPosts.map((post) => ({ id: post.id }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const generatedFeed = await readGeneratedFeed();
  const allServerPosts = [...generatedFeed.posts, ...mockPosts];
  const initialPost = getPostById(allServerPosts, id);
  const initialComments = generatedFeed.comments[id] ?? [];

  return (
    <PostDetailClient
      postId={id}
      initialPost={initialPost}
      initialComments={initialComments}
    />
  );
}
