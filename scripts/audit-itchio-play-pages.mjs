#!/usr/bin/env node

const options = parseArgs(process.argv.slice(2));
const baseUrl = stripTrailingSlash(
  options.baseUrl ||
    process.env.ITCHIO_AUDIT_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://aidaily-production.up.railway.app",
);
const timeoutMs = Number(options.timeoutMs || process.env.ITCHIO_AUDIT_TIMEOUT_MS || 60_000);
const limit = Number(options.limit || process.env.ITCHIO_AUDIT_LIMIT || 80);
const jsonOutput = Boolean(options.json);

if (options.help) {
  printHelp();
  process.exit(0);
}

const summary = await auditPlayPages();

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printSummary(summary);
}

process.exit(summary.ok ? 0 : 1);

async function auditPlayPages() {
  const startedAt = Date.now();
  const gamePageHtml = await fetchText(`${baseUrl}/interesting?tab=game&audit=${Date.now()}`);
  const playPaths = extractPlayPaths(gamePageHtml).slice(0, limit);
  const results = [];

  for (const path of playPaths) {
    results.push(await auditPlayPage(path));
  }

  return {
    ok: results.every((item) => item.ok),
    baseUrl,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    total: results.length,
    okCount: results.filter((item) => item.ok).length,
    results,
  };
}

async function auditPlayPage(path) {
  const url = `${baseUrl}${path}?audit=${Date.now()}`;
  const startedAt = Date.now();

  try {
    const html = await fetchText(url);
    const frameUrl = extractFrameUrl(html);
    const ok = Boolean(frameUrl && frameUrl.startsWith("https://itch.io/embed-upload/"));

    return {
      ok,
      path,
      url,
      frameUrl,
      durationMs: Date.now() - startedAt,
      failure: ok ? undefined : "iframe is not using itch.io embed-upload",
    };
  } catch (error) {
    return {
      ok: false,
      path,
      url,
      frameUrl: "",
      durationMs: Date.now() - startedAt,
      failure: formatError(error),
    };
  }
}

function extractPlayPaths(html) {
  const paths = new Set();
  const matches = html.matchAll(/href="(\/interesting\/itchio-[^"#?]+\/play)"/g);

  for (const match of matches) {
    paths.add(match[1]);
  }

  return Array.from(paths);
}

function extractFrameUrl(html) {
  const match = html.match(/<iframe\b[^>]*\bsrc="([^"]+)"/i);
  return match ? decodeHtmlAttribute(match[1]) : "";
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "cache-control": "no-cache",
        "user-agent": "AIQItchioAudit/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function printSummary(summary) {
  console.log(
    `[itchio-audit] ${summary.ok ? "OK" : "FAIL"} base=${summary.baseUrl} total=${summary.total} ok=${summary.okCount} durationMs=${summary.durationMs}`,
  );

  for (const result of summary.results) {
    console.log(
      `  ${result.ok ? "OK" : "FAIL"} ${result.path} frame=${result.frameUrl || "missing"} durationMs=${result.durationMs}`,
    );
    if (result.failure) {
      console.log(`    - ${result.failure}`);
    }
  }
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") parsed.json = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--base-url=")) parsed.baseUrl = arg.slice("--base-url=".length);
    else if (arg === "--base-url") parsed.baseUrl = args[++index];
    else if (arg.startsWith("--limit=")) parsed.limit = arg.slice("--limit=".length);
    else if (arg === "--limit") parsed.limit = args[++index];
    else if (arg.startsWith("--timeout-ms=")) parsed.timeoutMs = arg.slice("--timeout-ms=".length);
    else if (arg === "--timeout-ms") parsed.timeoutMs = args[++index];
  }

  return parsed;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/audit-itchio-play-pages.mjs

Options:
  --base-url <url>       Site base URL. Defaults to production URL.
  --limit <number>       Maximum play pages to audit. Defaults to 80.
  --timeout-ms <number>  Request timeout. Defaults to 60000.
  --json                 Print JSON result.
`);
}
