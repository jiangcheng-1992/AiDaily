import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
import { validateIngestRequest } from "@/lib/ingest-request-auth";
import { ingestArticleByUrl } from "@/lib/manual-article-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = validateIngestRequest(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as {
      url?: string;
      dryRun?: boolean;
    };

    const articleUrl = body.url?.trim();
    if (!articleUrl) {
      return Response.json({ ok: false, error: "url is required" }, { status: 400 });
    }

    const result = await ingestArticleByUrl(articleUrl);
    const current = await readGeneratedFeed({ includeSkills: true });
    const nextFeed = mergeGeneratedFeed({
      current,
      incomingPosts: [result.post],
      incomingComments: {
        [result.post.id]: result.comments,
      },
      limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
    });

    if (!body.dryRun) {
      await writeGeneratedFeed(nextFeed);
    }

    return Response.json(
      {
        ok: true,
        dryRun: Boolean(body.dryRun),
        persisted: !body.dryRun,
        sourceId: result.source.id,
        sourceName: result.source.name,
        postId: result.post.id,
        totalPostCount: nextFeed.posts.length,
        post: result.post,
        comments: result.comments,
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
        error: error instanceof Error ? error.message : "manual article ingest failed",
      },
      { status: 500 },
    );
  }
}

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
