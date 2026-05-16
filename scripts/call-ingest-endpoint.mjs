const baseUrl = process.env.APP_BASE_URL;
const cronSecret = process.env.CRON_SECRET;

if (!baseUrl) {
  throw new Error("APP_BASE_URL is required, for example https://your-app.up.railway.app");
}

if (!cronSecret) {
  throw new Error("CRON_SECRET is required for scheduled ingest");
}

const url = new URL("/api/cron/ingest", baseUrl);
const startedAt = Date.now();

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
