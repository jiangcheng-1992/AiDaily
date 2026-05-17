import { readGeneratedFeed } from "@/lib/generated-feed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await readGeneratedFeed();

  return Response.json({
    ok: true,
    service: "ai-circle",
    checkedAt: new Date().toISOString(),
    feedUpdatedAt: feed.updatedAt ?? null,
    postCount: feed.posts.length,
    autoIngest: {
      enabled: !["0", "false", "no", "off"].includes(
        (process.env.AUTO_INGEST_ENABLED ?? "true").toLowerCase(),
      ),
      intervalMinutes: Math.min(
        readPositiveNumber(process.env.AUTO_INGEST_INTERVAL_MINUTES, 15),
        15,
      ),
      initialDelayMs: Math.min(
        readPositiveNumber(process.env.AUTO_INGEST_INITIAL_DELAY_MS, 10000),
        10000,
      ),
    },
  });
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
