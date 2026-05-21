import { generateProductionAiComments } from "@/lib/ai-comment-service";
import type { Post } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      post?: Post;
      existingRoleIds?: string[];
    };

    if (!body.post?.id || !body.post.title) {
      return Response.json(
        { ok: false, error: "Valid post is required" },
        { status: 400 },
      );
    }

    const result = await generateProductionAiComments({
      post: body.post,
      existingRoleIds: body.existingRoleIds ?? [],
    });

    if (result.error) {
      return Response.json(
        {
          ok: false,
          provider: result.provider,
          comments: result.comments,
          error: result.error,
        },
        { status: 503 },
      );
    }

    return Response.json(
      {
        ok: true,
        provider: result.provider,
        comments: result.comments,
        skipped: result.skipped ?? false,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "AI comment failed",
      },
      { status: 500 },
    );
  }
}
