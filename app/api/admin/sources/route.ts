import { type NextRequest, NextResponse } from "next/server";

import {
  mergeGeneratedFeed,
  readGeneratedFeed,
  writeGeneratedFeed,
} from "@/lib/generated-feed-store";
import { authSessionCookie, getUserBySession } from "@/lib/auth-store";
import { ingestSubmittedSource } from "@/lib/submitted-source-ingest";
import {
  createSubmittedSourceId,
  readSubmittedSources,
  type SubmittedSourceKind,
  upsertSubmittedSource,
} from "@/lib/submitted-sources-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentAdminUser(request);
  if (!user) return adminOnlyResponse();

  const store = await readSubmittedSources();
  return NextResponse.json(
    {
      ok: true,
      sources: store.sources,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentAdminUser(request);
  if (!user) return adminOnlyResponse();

  try {
    const body = (await request.json()) as {
      kind?: SubmittedSourceKind | "auto";
      name?: string;
      url?: string;
      itemLimit?: number;
    };
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: "请填写信息源地址" }, { status: 400 });
    }

    const kind = body.kind === "auto" || !body.kind ? detectSourceKind(url) : body.kind;
    const name = body.name?.trim() || buildSourceName(kind, url);
    const now = new Date().toISOString();
    const source = await upsertSubmittedSource({
      id: createSubmittedSourceId(kind, url),
      kind,
      name,
      url,
      status: "active",
      submittedByUserId: user.id,
      submittedByEmail: user.email,
      submittedAt: now,
    });

    try {
      const result = await ingestSubmittedSource(source, clampItemLimit(body.itemLimit));
      const current = await readGeneratedFeed({ includeSkills: true });
      const nextFeed = mergeGeneratedFeed({
        current,
        incomingPosts: result.posts,
        incomingComments: result.comments,
        limit: readPositiveInt(process.env.GENERATED_FEED_LIMIT, 120),
      });
      await writeGeneratedFeed(nextFeed);
      const updatedSource = await upsertSubmittedSource({
        ...source,
        status: "active",
        lastFetchedAt: new Date().toISOString(),
        lastError: undefined,
        lastPostCount: result.posts.length,
      });

      return NextResponse.json(
        {
          ok: true,
          source: updatedSource,
          postCount: result.posts.length,
          totalPostCount: nextFeed.posts.length,
          posts: result.posts,
        },
        {
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    } catch (error) {
      const updatedSource = await upsertSubmittedSource({
        ...source,
        status: "active",
        lastFetchedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "信息源抓取失败",
        lastPostCount: 0,
      });

      return NextResponse.json(
        {
          ok: true,
          saved: true,
          willRetry: true,
          source: updatedSource,
          warning: updatedSource.lastError,
          postCount: 0,
          totalPostCount: (await readGeneratedFeed()).posts.length,
        },
        {
          status: 202,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "提交信息源失败",
      },
      { status: 500 },
    );
  }
}

async function getCurrentAdminUser(request: NextRequest) {
  const sessionId = request.cookies.get(authSessionCookie)?.value;
  const user = await getUserBySession(sessionId);
  return user?.isAdmin ? user : null;
}

function adminOnlyResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "仅管理员可以提交信息源",
    },
    { status: 403 },
  );
}

function detectSourceKind(url: string): SubmittedSourceKind {
  const lower = url.toLowerCase();
  if (lower.includes("douyin.com/user/")) return "douyin";
  if (lower.includes("space.bilibili.com/")) return "bilibili";
  if (lower.includes("youtube.com/feeds/videos.xml") || lower.includes("youtube.com/channel/")) {
    return "youtube";
  }
  if (/\.(xml|rss|atom)(\?|$)/i.test(lower) || lower.includes("/feed")) return "rss";
  return "website";
}

function buildSourceName(kind: SubmittedSourceKind, url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const prefix =
      kind === "douyin"
        ? "抖音"
        : kind === "bilibili"
          ? "B站"
          : kind === "youtube"
            ? "YouTube"
            : "网站";
    return `${prefix} · ${host}`;
  } catch {
    return "管理员提交信息源";
  }
}

function clampItemLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 5) : 3;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
