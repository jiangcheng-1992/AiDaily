const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_INITIAL_DELAY_MS = 10_000;

let timer = null;
let running = false;

export function startAutoIngest() {
  if (timer) return;

  const enabled = readBooleanEnv("AUTO_INGEST_ENABLED", true);

  if (!enabled) {
    console.log("[auto-ingest] disabled");
    return;
  }

  const intervalMinutes = readPositiveNumber(
    process.env.AUTO_INGEST_INTERVAL_MINUTES,
    DEFAULT_INTERVAL_MINUTES,
  );
  const cappedIntervalMinutes = Math.min(intervalMinutes, DEFAULT_INTERVAL_MINUTES);
  const initialDelayMs = readPositiveNumber(
    process.env.AUTO_INGEST_INITIAL_DELAY_MS,
    DEFAULT_INITIAL_DELAY_MS,
  );
  const cappedInitialDelayMs = Math.min(initialDelayMs, DEFAULT_INITIAL_DELAY_MS);
  const intervalMs = cappedIntervalMinutes * 60 * 1000;

  console.log(
    `[auto-ingest] enabled; first run in ${Math.round(
      cappedInitialDelayMs / 1000,
    )}s, then every ${cappedIntervalMinutes}m`,
  );

  setTimeout(() => {
    void runAutoIngest("startup");
  }, cappedInitialDelayMs).unref?.();

  timer = setInterval(() => {
    void runAutoIngest("interval");
  }, intervalMs);
  timer.unref?.();
}

async function runAutoIngest(reason) {
  if (running) {
    console.log(`[auto-ingest] skipped ${reason}; previous run is still active`);
    return;
  }

  running = true;
  const startedAt = Date.now();

  try {
    const headers = {
      accept: "application/json",
      "user-agent": process.env.AIQ_USER_AGENT || "AIQ/1.0 auto-ingest",
    };

    if (process.env.CRON_SECRET) {
      headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
    }

    console.log(`[auto-ingest] ${reason} started`);

    const worksPayload = await callIngestEndpoint(buildLocalIngestUrl("works"), headers);
    const feedPayload = await callIngestEndpoint(buildLocalIngestUrl("feed"), headers);
    console.log(
      `[auto-ingest] ${reason} complete in ${Date.now() - startedAt}ms; works=${
        worksPayload?.works?.totalWorkCount ?? "?"
      } (${worksPayload?.works?.itchio?.count ?? "?"} games, ${
        worksPayload?.works?.youtube?.count ?? "?"
      } videos), feed new=${feedPayload?.newPostCount ?? "?"}, total=${
        feedPayload?.totalPostCount ?? "?"
      }, video=${feedPayload?.video?.postCount ?? "?"} posts/${
        feedPayload?.video?.failureCount ?? "?"
      } failures`,
    );
  } catch (error) {
    console.error(
      `[auto-ingest] ${reason} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    running = false;
  }
}

async function callIngestEndpoint(url, headers) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return safeParseJson(text);
}

function buildLocalIngestUrl(mode) {
  const port = process.env.PORT || "3000";
  const url = new URL(`http://127.0.0.1:${port}/api/cron/ingest`);

  if (mode === "works") {
    url.searchParams.set("sourceLimit", "0");
    url.searchParams.set("githubLimit", "0");
    url.searchParams.set("douyinSourceLimit", "0");
    url.searchParams.set("backupVideoSourceLimit", "0");
    url.searchParams.set("submittedSourceLimit", "0");
    url.searchParams.set("xSourceLimit", "0");
    url.searchParams.set("xKeywordLimit", "0");
  }

  if (mode === "feed") {
    url.searchParams.set("productHuntDailyLimit", "0");
    url.searchParams.set("productHuntWeeklyLimit", "0");
    url.searchParams.set("itchioSourceLimit", "0");
    url.searchParams.set("itchioReviewLimit", "0");
    url.searchParams.set("itchioPublishLimit", "0");
    url.searchParams.set("youtubeWorksSourceLimit", "0");
    url.searchParams.set("youtubeWorksItemLimit", "0");
    url.searchParams.set("youtubeWorksPublishLimit", "0");
  }

  if (mode !== "works" && process.env.AUTO_INGEST_SOURCE_LIMIT) {
    url.searchParams.set("sourceLimit", process.env.AUTO_INGEST_SOURCE_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_ITEM_LIMIT) {
    url.searchParams.set("itemLimit", process.env.AUTO_INGEST_ITEM_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_GITHUB_LIMIT) {
    url.searchParams.set("githubLimit", process.env.AUTO_INGEST_GITHUB_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_DOUYIN_SOURCE_LIMIT) {
    url.searchParams.set("douyinSourceLimit", process.env.AUTO_INGEST_DOUYIN_SOURCE_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_DOUYIN_ITEM_LIMIT) {
    url.searchParams.set("douyinItemLimit", process.env.AUTO_INGEST_DOUYIN_ITEM_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_BACKUP_VIDEO_SOURCE_LIMIT) {
    url.searchParams.set(
      "backupVideoSourceLimit",
      process.env.AUTO_INGEST_BACKUP_VIDEO_SOURCE_LIMIT,
    );
  }

  if (mode !== "works" && process.env.AUTO_INGEST_BACKUP_VIDEO_ITEM_LIMIT) {
    url.searchParams.set(
      "backupVideoItemLimit",
      process.env.AUTO_INGEST_BACKUP_VIDEO_ITEM_LIMIT,
    );
  }

  if (mode !== "works" && process.env.AUTO_INGEST_SUBMITTED_SOURCE_LIMIT) {
    url.searchParams.set("submittedSourceLimit", process.env.AUTO_INGEST_SUBMITTED_SOURCE_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_X_SOURCE_LIMIT) {
    url.searchParams.set("xSourceLimit", process.env.AUTO_INGEST_X_SOURCE_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_X_ITEM_LIMIT) {
    url.searchParams.set("xItemLimit", process.env.AUTO_INGEST_X_ITEM_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_X_KEYWORD_LIMIT) {
    url.searchParams.set("xKeywordLimit", process.env.AUTO_INGEST_X_KEYWORD_LIMIT);
  }

  if (mode !== "works" && process.env.AUTO_INGEST_X_PUBLISH_LIMIT) {
    url.searchParams.set("xPublishLimit", process.env.AUTO_INGEST_X_PUBLISH_LIMIT);
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_PRODUCT_HUNT_WEEKLY_LIMIT) {
    url.searchParams.set(
      "productHuntWeeklyLimit",
      process.env.AUTO_INGEST_PRODUCT_HUNT_WEEKLY_LIMIT,
    );
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_PRODUCT_HUNT_DAILY_LIMIT) {
    url.searchParams.set(
      "productHuntDailyLimit",
      process.env.AUTO_INGEST_PRODUCT_HUNT_DAILY_LIMIT,
    );
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_ITCHIO_SOURCE_LIMIT) {
    url.searchParams.set("itchioSourceLimit", process.env.AUTO_INGEST_ITCHIO_SOURCE_LIMIT);
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_ITCHIO_REVIEW_LIMIT) {
    url.searchParams.set("itchioReviewLimit", process.env.AUTO_INGEST_ITCHIO_REVIEW_LIMIT);
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_ITCHIO_PUBLISH_LIMIT) {
    url.searchParams.set("itchioPublishLimit", process.env.AUTO_INGEST_ITCHIO_PUBLISH_LIMIT);
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_YOUTUBE_WORKS_SOURCE_LIMIT) {
    url.searchParams.set(
      "youtubeWorksSourceLimit",
      process.env.AUTO_INGEST_YOUTUBE_WORKS_SOURCE_LIMIT,
    );
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_YOUTUBE_WORKS_ITEM_LIMIT) {
    url.searchParams.set(
      "youtubeWorksItemLimit",
      process.env.AUTO_INGEST_YOUTUBE_WORKS_ITEM_LIMIT,
    );
  }

  if (mode !== "feed" && process.env.AUTO_INGEST_YOUTUBE_WORKS_PUBLISH_LIMIT) {
    url.searchParams.set(
      "youtubeWorksPublishLimit",
      process.env.AUTO_INGEST_YOUTUBE_WORKS_PUBLISH_LIMIT,
    );
  }

  return url;
}

function readBooleanEnv(value, fallback) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function readPositiveNumber(value, fallback) {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
