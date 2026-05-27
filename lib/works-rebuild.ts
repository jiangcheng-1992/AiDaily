import { fetchItchioWorks } from "@/lib/itchio-fetcher";
import { fetchProductHuntWorks } from "@/lib/product-hunt-fetcher";
import { fetchVimeoWorks } from "@/lib/vimeo-works-fetcher";
import { fetchYoutubeWorks } from "@/lib/youtube-works-fetcher";
import {
  mergeGeneratedWorks,
  readGeneratedWorks,
  writeGeneratedWorks,
} from "@/lib/generated-works-store";

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

  const productHuntRun = shouldFetchProductHunt()
    ? await fetchProductHuntWorks({
        weeklyLimit: readNonNegativeInt(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 50),
        dailyLimit: readNonNegativeInt(process.env.PRODUCT_HUNT_DAILY_LIMIT, 20),
      })
    : {
        ok: true,
        source: "producthunt" as const,
        count: 0,
        works: [],
      };
  const itchioRun = shouldFetchItchio()
    ? await fetchItchioWorks({
        sourceLimit: readNonNegativeInt(process.env.ITCHIO_SOURCE_LIMIT, 20),
        reviewLimit: readNonNegativeInt(process.env.ITCHIO_REVIEW_LIMIT, 60),
        publishLimit: readNonNegativeInt(process.env.ITCHIO_PUBLISH_LIMIT, 10),
      })
    : {
        ok: true,
        source: "itchio" as const,
        count: 0,
        works: [],
      };
  const youtubeRun = shouldFetchYoutubeWorks()
    ? await fetchYoutubeWorks({
        sourceLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 20),
        itemLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 3),
        publishLimit: readNonNegativeInt(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 8),
      })
    : {
        ok: true,
        source: "youtube" as const,
        count: 0,
        works: [],
      };
  const vimeoRun = shouldFetchVimeoWorks()
    ? await fetchVimeoWorks({
        pageLimit: readNonNegativeInt(process.env.VIMEO_WORKS_PAGE_LIMIT, 2),
        itemLimit: readNonNegativeInt(process.env.VIMEO_WORKS_ITEM_LIMIT, 12),
        publishLimit: readNonNegativeInt(process.env.VIMEO_WORKS_PUBLISH_LIMIT, 8),
      })
    : {
        ok: true,
        source: "vimeo" as const,
        count: 0,
        works: [],
      };
  const current = await readGeneratedWorks({ allowFallback: false });
  const incomingWorks = [...productHuntRun.works, ...itchioRun.works, ...youtubeRun.works, ...vimeoRun.works];

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
      vimeo: {
        ok: vimeoRun.ok,
        count: vimeoRun.count,
        fetchedAt: new Date().toISOString(),
        error: vimeoRun.error,
      },
    },
    limit: readPositiveInt(process.env.GENERATED_WORKS_LIMIT, 200),
  });

  await writeGeneratedWorks(nextWorks);

  console.info("[works-rebuild] completed", {
    reason,
    productHuntCount: productHuntRun.count,
    itchioCount: itchioRun.count,
    youtubeCount: youtubeRun.count,
    vimeoCount: vimeoRun.count,
    totalWorkCount: nextWorks.works.length,
  });
}

function shouldFetchProductHunt() {
  const weeklyLimit = readNonNegativeInt(process.env.PRODUCT_HUNT_WEEKLY_LIMIT, 50);
  const dailyLimit = readNonNegativeInt(process.env.PRODUCT_HUNT_DAILY_LIMIT, 20);

  return weeklyLimit > 0 || dailyLimit > 0;
}

function shouldFetchItchio() {
  return (
    readNonNegativeInt(process.env.ITCHIO_SOURCE_LIMIT, 20) > 0 &&
    readNonNegativeInt(process.env.ITCHIO_REVIEW_LIMIT, 60) > 0 &&
    readNonNegativeInt(process.env.ITCHIO_PUBLISH_LIMIT, 10) > 0
  );
}

function shouldFetchYoutubeWorks() {
  return (
    readNonNegativeInt(process.env.YOUTUBE_WORKS_SOURCE_LIMIT, 20) > 0 &&
    readNonNegativeInt(process.env.YOUTUBE_WORKS_ITEM_LIMIT, 3) > 0 &&
    readNonNegativeInt(process.env.YOUTUBE_WORKS_PUBLISH_LIMIT, 8) > 0
  );
}

function shouldFetchVimeoWorks() {
  return (
    readNonNegativeInt(process.env.VIMEO_WORKS_PAGE_LIMIT, 2) > 0 &&
    readNonNegativeInt(process.env.VIMEO_WORKS_ITEM_LIMIT, 12) > 0 &&
    readNonNegativeInt(process.env.VIMEO_WORKS_PUBLISH_LIMIT, 8) > 0
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
