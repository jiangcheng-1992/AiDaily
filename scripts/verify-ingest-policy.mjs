const baseUrl = resolveBaseUrl();
const startedAt = Date.now();
const sourceLimit = readNumberEnv("VERIFY_SOURCE_LIMIT", 12);
const itemLimit = readNumberEnv("VERIFY_ITEM_LIMIT", 6);
const githubLimit = readNumberEnv("VERIFY_GITHUB_LIMIT", 8);
const expectedPolicyVersion = process.env.EXPECT_POLICY_VERSION?.trim() || null;

const sourcesPayload = await getJson(new URL("/api/sources", baseUrl), {
  headers: buildHeaders(),
});
const allowedSourceIds = new Set(
  (sourcesPayload.sources ?? [])
    .filter((source) => source?.autoIngest === true)
    .map((source) => source.id)
    .filter(Boolean),
);

const ingestUrl = new URL("/api/cron/ingest", baseUrl);
ingestUrl.searchParams.set("sourceLimit", String(sourceLimit));
ingestUrl.searchParams.set("itemLimit", String(itemLimit));
ingestUrl.searchParams.set("githubLimit", String(githubLimit));

if (process.env.VERIFY_DRY_RUN === "1") {
  ingestUrl.searchParams.set("dryRun", "1");
}

const ingestPayload = await getJson(ingestUrl, {
  method: "POST",
  headers: buildHeaders(),
});
const healthPayload = await getJson(new URL("/api/health", baseUrl), {
  headers: buildHeaders(),
});
const feedPayload = await getJson(new URL("/api/feed", baseUrl), {
  headers: buildHeaders(),
});

const feedPosts = Array.isArray(feedPayload.posts) ? feedPayload.posts : [];
const githubPosts = feedPosts.filter((post) => String(post?.id || "").startsWith("github-"));
const missingSourceIdPosts = feedPosts.filter(
  (post) => post?.type !== "skill" && !extractSourceId(post),
);
const sourceCountMap = new Map();

for (const post of feedPosts) {
  const sourceId = extractSourceId(post);
  if (!sourceId) continue;
  sourceCountMap.set(sourceId, (sourceCountMap.get(sourceId) ?? 0) + 1);
}

const feedSourceIds = Array.from(sourceCountMap.keys()).sort();
const unexpectedSourceIds = feedSourceIds.filter((sourceId) => !allowedSourceIds.has(sourceId));
const missingAllowedSourceIds = Array.from(allowedSourceIds).filter(
  (sourceId) => !sourceCountMap.has(sourceId),
);
const sourceCounts = Array.from(sourceCountMap.entries())
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([sourceId, count]) => ({ sourceId, count }));

const checks = [
  {
    name: "ingest_request_ok",
    pass: ingestPayload.ok === true,
    details: {
      newPostCount: ingestPayload.newPostCount ?? null,
      totalPostCount: ingestPayload.totalPostCount ?? null,
      successCount: ingestPayload.successCount ?? null,
      failureCount: ingestPayload.failureCount ?? null,
    },
  },
  {
    name: "policy_version_present",
    pass: Boolean(healthPayload.feedPolicyVersion),
    details: {
      feedPolicyVersion: healthPayload.feedPolicyVersion ?? null,
    },
  },
  {
    name: "policy_version_match",
    pass:
      expectedPolicyVersion === null ||
      healthPayload.feedPolicyVersion === expectedPolicyVersion,
    details: {
      expected: expectedPolicyVersion,
      actual: healthPayload.feedPolicyVersion ?? null,
    },
  },
  {
    name: "feed_count_matches_health",
    pass: Number(healthPayload.postCount ?? -1) === feedPosts.length,
    details: {
      healthPostCount: healthPayload.postCount ?? null,
      feedPostCount: feedPosts.length,
    },
  },
  {
    name: "feed_has_posts",
    pass: feedPosts.length > 0,
    details: {
      feedPostCount: feedPosts.length,
    },
  },
  {
    name: "feed_contains_only_auto_ingest_sources",
    pass: unexpectedSourceIds.length === 0 && missingSourceIdPosts.length === 0,
    details: {
      unexpectedSourceIds,
      missingSourceIdPostIds: missingSourceIdPosts.map((post) => post.id),
    },
  },
  {
    name: "feed_excludes_github_skill_posts",
    pass: githubPosts.length === 0,
    details: {
      githubPostIds: githubPosts.map((post) => post.id),
    },
  },
];

const passed = checks.every((check) => check.pass);

console.log(
  JSON.stringify(
    {
      ok: passed,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      baseUrl: baseUrl.toString(),
      request: {
        sourceLimit,
        itemLimit,
        githubLimit,
        dryRun: process.env.VERIFY_DRY_RUN === "1",
      },
      health: {
        feedUpdatedAt: healthPayload.feedUpdatedAt ?? null,
        postCount: healthPayload.postCount ?? null,
        feedPolicyVersion: healthPayload.feedPolicyVersion ?? null,
      },
      ingest: {
        fetchedAt: ingestPayload.fetchedAt ?? null,
        newPostCount: ingestPayload.newPostCount ?? null,
        totalPostCount: ingestPayload.totalPostCount ?? null,
        successCount: ingestPayload.successCount ?? null,
        failureCount: ingestPayload.failureCount ?? null,
        githubRepoCount: ingestPayload.githubRepoCount ?? null,
      },
      sourceCounts,
      allowedAutoIngestSourceIds: Array.from(allowedSourceIds).sort(),
      missingAllowedSourceIds,
      checks,
    },
    null,
    2,
  ),
);

process.exitCode = passed ? 0 : 1;

function buildHeaders() {
  const headers = {
    accept: "application/json",
  };

  if (process.env.CRON_SECRET) {
    headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  return headers;
}

async function getJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText} ${url.toString()}\n${JSON.stringify(payload, null, 2)}`,
    );
  }

  return payload;
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
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

function readNumberEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function extractSourceId(post) {
  if (post?.sourceId) return String(post.sourceId);

  const id = String(post?.id || "");
  if (!id.startsWith("source-")) return null;

  const segments = id.split("-");
  if (segments.length < 4) return null;
  return segments.slice(1, -1).join("-");
}
