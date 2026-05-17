const baseUrl = resolveBaseUrl();
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  throw new Error("CRON_SECRET is required for scheduled ingest");
}

const url = new URL("/api/cron/ingest", baseUrl);
const startedAt = Date.now();

if (process.env.INGEST_DRY_RUN === "1") {
  url.searchParams.set("dryRun", "1");
}

setQueryParam("sourceLimit", process.env.INGEST_SOURCE_LIMIT);
setQueryParam("itemLimit", process.env.INGEST_ITEM_LIMIT);
setQueryParam("githubLimit", process.env.INGEST_GITHUB_LIMIT);

console.log(`Calling ingest endpoint: ${url.toString()}`);

const response = await fetch(url, {
  headers: {
    authorization: `Bearer ${cronSecret}`,
    accept: "application/json",
  },
});

const text = await response.text();

if (!response.ok) {
  throw new Error(`Ingest failed with ${response.status}: ${text}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: response.status,
      durationMs: Date.now() - startedAt,
      response: safeParseJson(text),
    },
    null,
    2,
  ),
);

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolveBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  if (process.env.RAILWAY_PRIVATE_DOMAIN) {
    const port = process.env.PORT || "3000";
    return `http://${process.env.RAILWAY_PRIVATE_DOMAIN}:${port}`;
  }

  throw new Error(
    "APP_BASE_URL is required, for example https://your-app.up.railway.app",
  );
}

function setQueryParam(name, value) {
  if (value !== undefined && value !== "") {
    url.searchParams.set(name, value);
  }
}
