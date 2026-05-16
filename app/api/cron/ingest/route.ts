import { fetchableSources } from "@/lib/ai-sources";
import { fetchSourceItems } from "@/lib/source-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IngestResult = {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  count: number;
  items?: Awaited<ReturnType<typeof fetchSourceItems>>;
  error?: string;
};

export async function GET(request: Request) {
  return handleIngestRequest(request);
}

export async function POST(request: Request) {
  return handleIngestRequest(request);
}

async function handleIngestRequest(request: Request) {
  const authError = validateCronRequest(request);

  if (authError) return authError;

  const sourceLimit = readPositiveInt(process.env.SOURCE_FETCH_LIMIT, 12);
  const itemLimit = readPositiveInt(process.env.SOURCE_ITEMS_PER_SOURCE, 6);
  const sources = fetchableSources.slice(0, sourceLimit);
  const fetched = await fetchSourcesWithLimit(sources, itemLimit, 4);

  return Response.json(
    {
      ok: true,
      dryRun: true,
      fetchedAt: new Date().toISOString(),
      sourceCount: sources.length,
      successCount: fetched.filter((result) => result.ok).length,
      failureCount: fetched.filter((result) => !result.ok).length,
      message:
        "当前版本会抓取并标准化候选内容。接入数据库后，可在这里加入去重、打分、入库和通知。",
      sources: fetched,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function validateCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return null;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is required in production" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function fetchSourcesWithLimit(
  sources: typeof fetchableSources,
  itemLimit: number,
  concurrency: number,
) {
  const results: IngestResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor];
      cursor += 1;

      try {
        const items = await fetchSourceItems(source, itemLimit);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          ok: true,
          count: items.length,
          items,
        });
      } catch (error) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          ok: false,
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sources.length) }, () => worker()),
  );

  return results.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
