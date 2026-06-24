import {
  GENERATED_FEED_POLICY_VERSION,
  readGeneratedFeed,
  readGeneratedFeedStatus,
} from "@/lib/generated-feed-store";
import { readGeneratedWorks, readGeneratedWorksStatus } from "@/lib/generated-works-store";
import { getAdminAuthStatus, getAuthPersistenceInfo } from "@/lib/auth-store";
import { getWorkCategoryId } from "@/lib/interesting-works";
import { getMiniMaxTextStatus } from "@/lib/minimax-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await readGeneratedFeed({ allowFallback: false });
  const feedStatus = await readGeneratedFeedStatus();
  const works = await readGeneratedWorks({ allowFallback: false });
  const worksStatus = await readGeneratedWorksStatus();
  const currentGameCount = works.works.filter((work) => getWorkCategoryId(work) === "game").length;
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
    gameCount: currentGameCount,
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
      aiDrama: {
        independent: true,
        sourceLimit: readNonNegativeNumber(process.env.AI_DRAMA_SOURCE_LIMIT, 3),
        itemLimit: readPositiveNumber(process.env.AI_DRAMA_ITEMS_PER_SOURCE, 4),
      },
      x: {
        configured: Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN),
        sourceLimit: readNonNegativeNumber(process.env.X_SOURCE_LIMIT, 24),
        itemLimit: readPositiveNumber(process.env.X_ITEMS_PER_SOURCE, 3),
        keywordQueryLimit: readNonNegativeNumber(process.env.X_KEYWORD_QUERY_LIMIT, 0),
        publishLimit: readNonNegativeNumber(process.env.X_PUBLISH_LIMIT, 12),
      },
      works: {
        productHunt: {
          configured: Boolean(process.env.PRODUCT_HUNT_TOKEN || process.env.PRODUCTHUNT_TOKEN),
          weeklyLimit: readNonNegativeNumber(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 50),
          dailyLimit: readNonNegativeNumber(process.env.PRODUCT_HUNT_DAILY_LIMIT, 20),
        },
        itchio: {
          configured: true,
          sourceLimit: readNonNegativeNumber(process.env.ITCHIO_SOURCE_LIMIT, 24),
          pageLimit: readNonNegativeNumber(process.env.ITCHIO_PAGE_LIMIT, 2),
          reviewLimit: readNonNegativeNumber(process.env.ITCHIO_REVIEW_LIMIT, 70),
          publishLimit: readNonNegativeNumber(process.env.ITCHIO_PUBLISH_LIMIT, 10),
          targetCount: readNonNegativeNumber(process.env.ITCHIO_TARGET_COUNT, 100),
        },
        youtube: {
          configured: true,
          sourceLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 20),
          itemLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 5),
          publishLimit: readNonNegativeNumber(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 10),
        },
        liblib: {
          configured: true,
          itemLimit: readNonNegativeNumber(process.env.LIBLIB_WORKS_ITEM_LIMIT, 24),
          publishLimit: readNonNegativeNumber(process.env.LIBLIB_WORKS_PUBLISH_LIMIT, 10),
        },
        vimeo: {
          configured: true,
          pageLimit: readNonNegativeNumber(process.env.VIMEO_WORKS_PAGE_LIMIT, 2),
          itemLimit: readNonNegativeNumber(process.env.VIMEO_WORKS_ITEM_LIMIT, 12),
          publishLimit: readNonNegativeNumber(process.env.VIMEO_WORKS_PUBLISH_LIMIT, 8),
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
