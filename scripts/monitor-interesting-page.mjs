#!/usr/bin/env node

const defaultBaseUrl =
  process.env.INTERESTING_MONITOR_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_BASE_URL ||
  "https://aidaily-production.up.railway.app";

const emptyMessage = "这个分类暂时没有作品";
const defaultTabs = ["all", "media", "website-agent", "game", "skill"];

const options = parseArgs(process.argv.slice(2));
const baseUrl = stripTrailingSlash(options.baseUrl || defaultBaseUrl);
const tabs = parseCsv(options.tabs || process.env.INTERESTING_MONITOR_TABS) ?? defaultTabs;
const intervalMs = Number(options.intervalMs || process.env.INTERESTING_MONITOR_INTERVAL_MS || 300_000);
const timeoutMs = Number(options.timeoutMs || process.env.INTERESTING_MONITOR_TIMEOUT_MS || 60_000);
const minCards = Number(options.minCards || process.env.INTERESTING_MONITOR_MIN_CARDS || 1);
const minFeedPosts = Number(options.minFeedPosts || process.env.INTERESTING_MONITOR_MIN_FEED_POSTS || 40);
const webhookUrl = options.webhookUrl || process.env.INTERESTING_MONITOR_WEBHOOK_URL;
const loop = Boolean(options.loop);
const jsonOutput = Boolean(options.json);

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
  console.error(`[interesting-monitor] invalid base url: ${baseUrl}`);
  process.exit(2);
}

if (loop) {
  console.log(
    `[interesting-monitor] loop started base=${baseUrl} tabs=${tabs.join(",")} intervalMs=${intervalMs}`,
  );
  while (true) {
    await runOnceAndReport();
    await sleep(intervalMs);
  }
} else {
  const ok = await runOnceAndReport();
  process.exit(ok ? 0 : 1);
}

async function runOnceAndReport() {
  const startedAt = new Date();
  const results = [];
  for (const tab of tabs) {
    results.push(await checkTab(tab));
  }
  const feed = await checkFeed();
  const ok = results.every((item) => item.ok);
  const overallOk = ok && feed.ok;
  const summary = {
    ok: overallOk,
    checkedAt: startedAt.toISOString(),
    baseUrl,
    durationMs: Date.now() - startedAt.getTime(),
    feed,
    results,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }

  if (!overallOk && webhookUrl) {
    await notifyWebhook(summary);
  }

  return overallOk;
}

async function checkTab(tab) {
  const url = `${baseUrl}/interesting?tab=${encodeURIComponent(tab)}&monitor=${Date.now()}`;
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    const html = await response.text();
    const statusOk = response.status >= 200 && response.status < 400;
    const hasEmptyMessage = html.includes(emptyMessage);
    const cardCount = countInterestingCards(html);
    const hasHydrationData = html.includes("self.__next_f") || html.includes("__NEXT_DATA__");
    const markers = readCategoryMarkers(tab, html);
    const failures = [];

    if (!statusOk) failures.push(`HTTP ${response.status}`);
    if (hasEmptyMessage) failures.push("empty category message visible");
    if (cardCount < minCards) failures.push(`card count ${cardCount} < ${minCards}`);
    if (!hasHydrationData) failures.push("missing Next.js hydration data");
    for (const marker of markers.missing) failures.push(`missing marker: ${marker}`);

    return {
      tab,
      ok: failures.length === 0,
      url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      cardCount,
      htmlLength: html.length,
      hasEmptyMessage,
      markers,
      failures,
    };
  } catch (error) {
    return {
      tab,
      ok: false,
      url,
      status: 0,
      durationMs: Date.now() - startedAt,
      cardCount: 0,
      htmlLength: 0,
      hasEmptyMessage: false,
      markers: { expected: [], missing: [] },
      failures: [formatError(error)],
    };
  }
}

async function checkFeed() {
  const url = `${baseUrl}/api/feed?monitor=${Date.now()}`;
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    const data = await response.json();
    const postCount = Array.isArray(data.posts) ? data.posts.length : 0;
    const failures = [];

    if (response.status < 200 || response.status >= 400) failures.push(`HTTP ${response.status}`);
    if (data.fallbackActive) failures.push("feed fallback active");
    if (postCount < minFeedPosts) failures.push(`feed post count ${postCount} < ${minFeedPosts}`);

    return {
      ok: failures.length === 0,
      url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      postCount,
      persistedPostCount: data.persistedPostCount,
      fallbackActive: Boolean(data.fallbackActive),
      failures,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      status: 0,
      durationMs: Date.now() - startedAt,
      postCount: 0,
      persistedPostCount: 0,
      fallbackActive: false,
      failures: [formatError(error)],
    };
  }
}

function readCategoryMarkers(tab, html) {
  const expectedByTab = {
    game: parseCsv(process.env.INTERESTING_MONITOR_GAME_MARKERS) ?? ["itchio", "浏览器可玩"],
    skill: parseCsv(process.env.INTERESTING_MONITOR_SKILL_MARKERS) ?? ["Skill"],
  };
  const expected = expectedByTab[tab] ?? [];
  const missing = expected.filter((marker) => !html.includes(marker));
  return { expected, missing };
}

function countInterestingCards(html) {
  const matches = html.match(/href="\/interesting\/(?!\?)[^"#?]+"/g);
  return matches ? matches.length : 0;
}

async function fetchWithTimeout(url, ms, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "cache-control": "no-cache",
        "user-agent": "AIQInterestingMonitor/1.0",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyWebhook(summary) {
  try {
    await fetchWithTimeout(webhookUrl, timeoutMs, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(summary),
    });
  } catch (error) {
    console.error(`[interesting-monitor] webhook failed: ${formatError(error)}`);
  }
}

function printSummary(summary) {
  const status = summary.ok ? "OK" : "FAIL";
  console.log(
    `[interesting-monitor] ${status} ${summary.checkedAt} base=${summary.baseUrl} durationMs=${summary.durationMs}`,
  );
  console.log(
    `  ${summary.feed.ok ? "OK" : "FAIL"} feed status=${summary.feed.status} posts=${summary.feed.postCount} persisted=${summary.feed.persistedPostCount} fallback=${summary.feed.fallbackActive} durationMs=${summary.feed.durationMs}`,
  );
  for (const failure of summary.feed.failures) {
    console.log(`    - ${failure}`);
  }

  for (const result of summary.results) {
    const lineStatus = result.ok ? "OK" : "FAIL";
    console.log(
      `  ${lineStatus} tab=${result.tab} status=${result.status} cards=${result.cardCount} empty=${result.hasEmptyMessage} durationMs=${result.durationMs}`,
    );
    for (const failure of result.failures) {
      console.log(`    - ${failure}`);
    }
  }
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--loop") parsed.loop = true;
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--base-url=")) parsed.baseUrl = arg.slice("--base-url=".length);
    else if (arg === "--base-url") parsed.baseUrl = args[++index];
    else if (arg.startsWith("--tabs=")) parsed.tabs = arg.slice("--tabs=".length);
    else if (arg === "--tabs") parsed.tabs = args[++index];
    else if (arg.startsWith("--interval-ms=")) parsed.intervalMs = arg.slice("--interval-ms=".length);
    else if (arg === "--interval-ms") parsed.intervalMs = args[++index];
    else if (arg.startsWith("--timeout-ms=")) parsed.timeoutMs = arg.slice("--timeout-ms=".length);
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
    else if (arg.startsWith("--min-cards=")) parsed.minCards = arg.slice("--min-cards=".length);
    else if (arg === "--min-cards") parsed.minCards = args[++index];
    else if (arg.startsWith("--min-feed-posts=")) parsed.minFeedPosts = arg.slice("--min-feed-posts=".length);
    else if (arg === "--min-feed-posts") parsed.minFeedPosts = args[++index];
    else if (arg.startsWith("--webhook-url=")) parsed.webhookUrl = arg.slice("--webhook-url=".length);
    else if (arg === "--webhook-url") parsed.webhookUrl = args[++index];
  }

  return parsed;
}

function parseCsv(value) {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/monitor-interesting-page.mjs
  node scripts/monitor-interesting-page.mjs --loop --interval-ms 300000

Options:
  --base-url <url>       Site base URL. Defaults to INTERESTING_MONITOR_BASE_URL or production URL.
  --tabs <csv>           Tabs to check. Defaults to all,media,website-agent,game,skill.
  --min-cards <number>   Minimum card links expected per tab. Defaults to 1.
  --min-feed-posts <n>   Minimum /api/feed posts expected. Defaults to 40.
  --timeout-ms <number>  Request timeout. Defaults to 60000.
  --loop                 Keep checking forever.
  --interval-ms <number> Loop interval. Defaults to 300000.
  --json                 Print JSON result.
  --webhook-url <url>    POST failure summary to a webhook.
`);
}
