const baseUrl = resolveBaseUrl();
const articleUrl = process.env.ARTICLE_URL?.trim();

if (!articleUrl) {
  throw new Error("ARTICLE_URL is required");
}

const response = await fetch(new URL("/api/ingest/article", baseUrl), {
  method: "POST",
  headers: buildHeaders(),
  body: JSON.stringify({
    url: articleUrl,
    dryRun: process.env.INGEST_DRY_RUN === "1",
  }),
});

const text = await response.text();
const payload = safeParseJson(text);

if (!response.ok) {
  throw new Error(`Manual article ingest failed with ${response.status}: ${text}`);
}

console.log(JSON.stringify(payload, null, 2));

function buildHeaders() {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (process.env.CRON_SECRET) {
    headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  return headers;
}

function resolveBaseUrl() {
  if (process.env.APP_BASE_URL) return new URL(process.env.APP_BASE_URL);

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return new URL(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  if (process.env.RAILWAY_PRIVATE_DOMAIN) {
    const port = process.env.PORT || "3000";
    return new URL(`http://${process.env.RAILWAY_PRIVATE_DOMAIN}:${port}`);
  }

  return new URL("http://localhost:3000");
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
