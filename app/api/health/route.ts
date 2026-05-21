import {
  GENERATED_FEED_POLICY_VERSION,
  readGeneratedFeed,
} from "@/lib/generated-feed-store";
import { getAuthPersistenceInfo } from "@/lib/auth-store";
import { getMiniMaxTextStatus } from "@/lib/minimax-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await readGeneratedFeed();
  const authPersistence = getAuthPersistenceInfo();
  const textAi = getMiniMaxTextStatus();

  return Response.json({
    ok: true,
    service: "ai-circle",
    checkedAt: new Date().toISOString(),
    feedUpdatedAt: feed.updatedAt ?? null,
    postCount: feed.posts.length,
    feedPolicyVersion: GENERATED_FEED_POLICY_VERSION,
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
      video: {
        independent: true,
        douyinSourceLimit: readNonNegativeNumber(
          process.env.AUTO_INGEST_DOUYIN_SOURCE_LIMIT ?? process.env.DOUYIN_SOURCE_LIMIT,
          12,
        ),
        douyinItemLimit: readPositiveNumber(
          process.env.AUTO_INGEST_DOUYIN_ITEM_LIMIT ?? process.env.DOUYIN_ITEMS_PER_SOURCE,
          2,
        ),
      },
    },
    aiComments: {
      backend: textAi.backend,
      model: textAi.model,
      configured: textAi.configured,
    },
    authPersistence,
  });
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
