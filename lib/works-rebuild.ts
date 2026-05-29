import { fetchItchioWorks } from "@/lib/itchio-fetcher";
import { fetchLiblibWorks } from "@/lib/liblib-works-fetcher";
import { fetchProductHuntWorks } from "@/lib/product-hunt-fetcher";
import { fetchVimeoWorks } from "@/lib/vimeo-works-fetcher";
import { fetchYoutubeWorks } from "@/lib/youtube-works-fetcher";
import {
  mergeGeneratedWorks,
  readGeneratedWorks,
  writeGeneratedWorks,
} from "@/lib/generated-works-store";
import { getWorkCategoryId, type WorkItem } from "@/lib/interesting-works";

let rebuildPromise: Promise<void> | null = null;

export function triggerWorksRebuild(reason: string) {
  if (rebuildPromise) return rebuildPromise;

  rebuildPromise = rebuildGeneratedWorks(reason).finally(() => {
    rebuildPromise = null;
  });

  return rebuildPromise;
}

async function rebuildGeneratedWorks(reason: string) {
  console.info("[works-rebuild] started", { reason });
  const current = await readGeneratedWorks({ allowFallback: false });
  const currentGameCount = countGameWorks(current.works);
  const effectiveItchioSettings = computeItchioFillSettings({
    currentGameCount,
    targetGameCount: readNonNegativeInt(process.env.ITCHIO_TARGET_COUNT, 160),
    sourceLimit: readNonNegativeInt(process.env.ITCHIO_SOURCE_LIMIT, 24),
    pageLimit: readNonNegativeInt(process.env.ITCHIO_PAGE_LIMIT, 2),
    reviewLimit: readNonNegativeInt(process.env.ITCHIO_REVIEW_LIMIT, 90),
    publishLimit: readNonNegativeInt(process.env.ITCHIO_PUBLISH_LIMIT, 24),
  });

  const [productHuntRun, itchioRun, youtubeRun, liblibRun, vimeoRun] = await Promise.all([
    shouldFetchProductHunt()
      ? fetchProductHuntWorks({
          weeklyLimit: readNonNegativeInt(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 80),
          dailyLimit: readNonNegativeInt(process.env.PRODUCT_HUNT_DAILY_LIMIT, 40),
        })
      : Promise.resolve({
          ok: true,
          source: "producthunt" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
    shouldFetchItchio()
      ? fetchItchioWorks({
          sourceLimit: effectiveItchioSettings.sourceLimit,
          pageLimit: effectiveItchioSettings.pageLimit,
          reviewLimit: effectiveItchioSettings.reviewLimit,
          publishLimit: effectiveItchioSettings.publishLimit,
        })
      : Promise.resolve({
          ok: true,
          source: "itchio" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
    shouldFetchYoutubeWorks()
      ? fetchYoutubeWorks({
          sourceLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 25),
          itemLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 5),
          publishLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 16),
        })
      : Promise.resolve({
          ok: true,
          source: "youtube" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
    shouldFetchLiblibWorks()
      ? fetchLiblibWorks({
          itemLimit: readNonNegativeInt(process.env.LIBLIB_WORKS_ITEM_LIMIT, 36),
          publishLimit: readNonNegativeInt(process.env.LIBLIB_WORKS_PUBLISH_LIMIT, 16),
        })
      : Promise.resolve({
          ok: true,
          source: "liblib" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
    shouldFetchVimeoWorks()
      ? fetchVimeoWorks({
          pageLimit: readNonNegativeInt(process.env.VIMEO_WORKS_PAGE_LIMIT, 3),
          itemLimit: readNonNegativeInt(process.env.VIMEO_WORKS_ITEM_LIMIT, 12),
          publishLimit: readNonNegativeInt(process.env.VIMEO_WORKS_PUBLISH_LIMIT, 14),
        })
      : Promise.resolve({
          ok: true,
          source: "vimeo" as const,
          count: 0,
          works: [],
          error: undefined,
        }),
  ]);
  const incomingWorks = [
    ...productHuntRun.works,
    ...itchioRun.works,
    ...youtubeRun.works,
    ...liblibRun.works,
    ...vimeoRun.works,
  ];

  if (incomingWorks.length === 0 && current.works.length === 0) {
    throw new Error("[works-rebuild] skipped persist because ingest returned no works");
  }

  const nextWorks = mergeGeneratedWorks({
    current,
    incomingWorks,
    sourceStatus: {
      producthunt: {
        ok: productHuntRun.ok,
        count: productHuntRun.count,
        fetchedAt: new Date().toISOString(),
        error: productHuntRun.error,
      },
      itchio: {
        ok: itchioRun.ok,
        count: itchioRun.count,
        fetchedAt: new Date().toISOString(),
        error: itchioRun.error,
      },
      youtube: {
        ok: youtubeRun.ok,
        count: youtubeRun.count,
        fetchedAt: new Date().toISOString(),
        error: youtubeRun.error,
      },
      liblib: {
        ok: liblibRun.ok,
        count: liblibRun.count,
        fetchedAt: new Date().toISOString(),
        error: liblibRun.error,
      },
      vimeo: {
        ok: vimeoRun.ok,
        count: vimeoRun.count,
        fetchedAt: new Date().toISOString(),
        error: vimeoRun.error,
      },
    },
    limit: readPositiveInt(process.env.GENERATED_WORKS_LIMIT, 320),
  });

  await writeGeneratedWorks(nextWorks);

  console.info("[works-rebuild] completed", {
    reason,
    currentGameCount,
    productHuntCount: productHuntRun.count,
    itchioCount: itchioRun.count,
    youtubeCount: youtubeRun.count,
    liblibCount: liblibRun.count,
    vimeoCount: vimeoRun.count,
    totalWorkCount: nextWorks.works.length,
  });
}

function shouldFetchProductHunt() {
  const weeklyLimit = readNonNegativeInt(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 80);
  const dailyLimit = readNonNegativeInt(process.env.PRODUCT_HUNT_DAILY_LIMIT, 40);

  return weeklyLimit > 0 || dailyLimit > 0;
}

function shouldFetchItchio() {
  return (
    readNonNegativeInt(process.env.ITCHIO_SOURCE_LIMIT, 24) > 0 &&
    readNonNegativeInt(process.env.ITCHIO_PAGE_LIMIT, 2) > 0 &&
    readNonNegativeInt(process.env.ITCHIO_REVIEW_LIMIT, 90) > 0 &&
    readNonNegativeInt(process.env.ITCHIO_PUBLISH_LIMIT, 24) > 0
  );
}

function shouldFetchYoutubeWorks() {
  return (
    readNonNegativeInt(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 25) > 0 &&
    readNonNegativeInt(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 5) > 0 &&
    readNonNegativeInt(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 16) > 0
  );
}

function shouldFetchLiblibWorks() {
  return (
    readNonNegativeInt(process.env.LIBLIB_WORKS_ITEM_LIMIT, 36) > 0 &&
    readNonNegativeInt(process.env.LIBLIB_WORKS_PUBLISH_LIMIT, 16) > 0
  );
}

function shouldFetchVimeoWorks() {
  return (
    readNonNegativeInt(process.env.VIMEO_WORKS_PAGE_LIMIT, 3) > 0 &&
    readNonNegativeInt(process.env.VIMEO_WORKS_ITEM_LIMIT, 12) > 0 &&
    readNonNegativeInt(process.env.VIMEO_WORKS_PUBLISH_LIMIT, 14) > 0
  );
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function countGameWorks(works: WorkItem[]) {
  return works.filter((work) => getWorkCategoryId(work) === "game").length;
}

function computeItchioFillSettings({
  currentGameCount,
  targetGameCount,
  sourceLimit,
  pageLimit,
  reviewLimit,
  publishLimit,
}: {
  currentGameCount: number;
  targetGameCount: number;
  sourceLimit: number;
  pageLimit: number;
  reviewLimit: number;
  publishLimit: number;
}) {
  const deficit = Math.max(0, targetGameCount - currentGameCount);

  if (deficit === 0) {
    return {
      sourceLimit,
      pageLimit,
      reviewLimit,
      publishLimit,
    };
  }

  return {
    sourceLimit: Math.max(sourceLimit, 24),
    pageLimit: Math.max(pageLimit, Math.min(3, 1 + Math.ceil(deficit / 40))),
    reviewLimit: Math.max(reviewLimit, Math.min(150, Math.max(90, deficit * 2))),
    publishLimit: Math.max(publishLimit, Math.min(48, Math.max(24, deficit))),
  };
}
