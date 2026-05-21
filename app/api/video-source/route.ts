import { refreshDouyinVideoItemByUrl } from "@/lib/douyin-video-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as {
      sourceId?: string;
      sourceUrl?: string;
    };

    const sourceUrl = body.sourceUrl?.trim();
    console.info("[api/video-source] request received", {
      sourceId: body.sourceId?.trim() ?? null,
      sourceUrl: sourceUrl ?? null,
    });
    if (!sourceUrl) {
      return Response.json({ ok: false, error: "sourceUrl is required" }, { status: 400 });
    }

    const refreshed = await refreshDouyinVideoItemByUrl({
      sourceId: body.sourceId?.trim(),
      sourceUrl,
    });

    console.info("[api/video-source] refresh completed", {
      sourceId: body.sourceId?.trim() ?? null,
      sourceUrl,
      hasVideoUrl: Boolean(refreshed?.videoUrl),
      hasVideoEmbedUrl: Boolean(refreshed?.videoEmbedUrl),
      profileUrl: refreshed?.profileUrl ?? null,
      elapsedMs: Date.now() - startedAt,
    });

    return Response.json(
      {
        ok: true,
        videoUrl: refreshed?.videoUrl ?? null,
        videoEmbedUrl: refreshed?.videoEmbedUrl ?? null,
        coverImageUrl: refreshed?.coverImageUrl ?? null,
        profileUrl: refreshed?.profileUrl ?? null,
        directVideoAvailable: Boolean(refreshed?.videoUrl),
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/video-source] refresh failed", {
      error: error instanceof Error ? error.message : "video refresh failed",
      elapsedMs: Date.now() - startedAt,
    });
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "video refresh failed",
      },
      { status: 500 },
    );
  }
}
