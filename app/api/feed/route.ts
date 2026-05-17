import { readGeneratedFeed } from "@/lib/generated-feed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await readGeneratedFeed();

  return Response.json(
    {
      ok: true,
      updatedAt: feed.updatedAt,
      posts: feed.posts,
      comments: feed.comments,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
