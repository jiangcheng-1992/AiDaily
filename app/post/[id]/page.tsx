import { PostDetailClient } from "@/components/post-detail-client";
import { mockPosts } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockPosts.map((post) => ({ id: post.id }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PostDetailClient postId={id} />;
}
