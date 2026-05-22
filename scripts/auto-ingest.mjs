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
    const url = buildLocalIngestUrl();
    const headers = {
      accept: "application/json",
      "user-agent": process.env.AIQ_USER_AGENT || "AIQ/1.0 auto-ingest",
    };

    if (process.env.CRON_SECRET) {
      headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
    }

    console.log(`[auto-ingest] ${reason} started`);

    const response = await fetch(url, {
      headers,
      cache: "no-store",
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    const payload = safeParseJson(text);
    console.log(
      `[auto-ingest] ${reason} complete in ${Date.now() - startedAt}ms; new=${
        payload?.newPostCount ?? "?"
      }, total=${payload?.totalPostCount ?? "?"}, video=${
        payload?.video?.postCount ?? "?"
      } posts/${payload?.video?.failureCount ?? "?"} failures`,
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

function buildLocalIngestUrl() {
  const port = process.env.PORT || "3000";
  const url = new URL(`http://127.0.0.1:${port}/api/cron/ingest`);

  if (process.env.AUTO_INGEST_SOURCE_LIMIT) {
    url.searchParams.set("sourceLimit", process.env.AUTO_INGEST_SOURCE_LIMIT);
  }

  if (process.env.AUTO_INGEST_ITEM_LIMIT) {
    url.searchParams.set("itemLimit", process.env.AUTO_INGEST_ITEM_LIMIT);
  }

  if (process.env.AUTO_INGEST_GITHUB_LIMIT) {
    url.searchParams.set("githubLimit", process.env.AUTO_INGEST_GITHUB_LIMIT);
  }

  if (process.env.AUTO_INGEST_DOUYIN_SOURCE_LIMIT) {
    url.searchParams.set("douyinSourceLimit", process.env.AUTO_INGEST_DOUYIN_SOURCE_LIMIT);
  }

  if (process.env.AUTO_INGEST_DOUYIN_ITEM_LIMIT) {
    url.searchParams.set("douyinItemLimit", process.env.AUTO_INGEST_DOUYIN_ITEM_LIMIT);
  }

  if (process.env.AUTO_INGEST_BACKUP_VIDEO_SOURCE_LIMIT) {
    url.searchParams.set(
      "backupVideoSourceLimit",
      process.env.AUTO_INGEST_BACKUP_VIDEO_SOURCE_LIMIT,
    );
  }

  if (process.env.AUTO_INGEST_BACKUP_VIDEO_ITEM_LIMIT) {
    url.searchParams.set(
      "backupVideoItemLimit",
      process.env.AUTO_INGEST_BACKUP_VIDEO_ITEM_LIMIT,
    );
  }

  if (process.env.AUTO_INGEST_SUBMITTED_SOURCE_LIMIT) {
    url.searchParams.set("submittedSourceLimit", process.env.AUTO_INGEST_SUBMITTED_SOURCE_LIMIT);
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
