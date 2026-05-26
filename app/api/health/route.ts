import {
  GENERATED_FEED_POLICY_VERSION,
  readGeneratedFeed,
  readGeneratedFeedStatus,
} from "@/lib/generated-feed-store";
import { readGeneratedWorksStatus } from "@/lib/generated-works-store";
import { getAdminAuthStatus, getAuthPersistenceInfo } from "@/lib/auth-store";
import { getMiniMaxTextStatus } from "@/lib/minimax-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await readGeneratedFeed({ allowFallback: false });
  const feedStatus = await readGeneratedFeedStatus();
  const worksStatus = await readGeneratedWorksStatus();
  const authPersistence = getAuthPersistenceInfo();
  const textAi = getMiniMaxTextStatus();

  return Response.json({
    ok: true,
    service: "ai-circle",
    checkedAt: new Date().toISOString(),
    feedUpdatedAt: feed.updatedAt ?? null,
    postCount: feed.posts.length,
    feedStorage: feedStatus,
    worksStorage: worksStatus,
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
        backupSourceLimit: readNonNegativeNumber(
          process.env.AUTO_INGEST_BACKUP_VIDEO_SOURCE_LIMIT ??
            process.env.BACKUP_VIDEO_SOURCE_LIMIT,
          6,
        ),
        backupItemLimit: readPositiveNumber(
          process.env.AUTO_INGEST_BACKUP_VIDEO_ITEM_LIMIT ??
            process.env.BACKUP_VIDEO_ITEMS_PER_SOURCE,
          2,
        ),
        backupPlatforms: {
          youtube: true,
          bilibili: true,
          bilibiliRssHub: Boolean(process.env.RSSHUB_BASE_URL),
        },
      },
      works: {
        productHunt: {
          configured: Boolean(process.env.PRODUCT_HUNT_TOKEN || process.env.PRODUCTHUNT_TOKEN),
          weeklyLimit: readNonNegativeNumber(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 50),
          dailyLimit: readNonNegativeNumber(process.env.PRODUCT_HUNT_DAILY_LIMIT, 20),
        },
        itchio: {
          configured: true,
          sourceLimit: readNonNegativeNumber(process.env.ITCHIO_SOURCE_LIMIT, 20),
          reviewLimit: readNonNegativeNumber(process.env.ITCHIO_REVIEW_LIMIT, 60),
          publishLimit: readNonNegativeNumber(process.env.ITCHIO_PUBLISH_LIMIT, 10),
        },
        youtube: {
          configured: true,
          sourceLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 20),
          itemLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 3),
          publishLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 8),
        },
      },
    },
    aiComments: {
      backend: textAi.backend,
      model: textAi.model,
      configured: textAi.configured,
    },
    authPersistence,
    admin: getAdminAuthStatus(),
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
