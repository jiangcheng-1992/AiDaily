import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedImageHosts = new Set(["i.qbitai.com", "www.qbitai.com"]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawImageUrl = requestUrl.searchParams.get("url")?.trim();
  const rawReferrerUrl = requestUrl.searchParams.get("ref")?.trim();

  if (!rawImageUrl) {
    return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawImageUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid image url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol) || !allowedImageHosts.has(imageUrl.hostname)) {
    return NextResponse.json({ ok: false, error: "image host is not allowed" }, { status: 403 });
  }

  const referrer = buildSafeReferrer(rawReferrerUrl, imageUrl);

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: referrer,
        "user-agent":
          process.env.AIQ_USER_AGENT ??
          "Mozilla/5.0 (compatible; AIQImageProxy/1.0; +https://aidaily-production.up.railway.app)",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `upstream image failed: ${upstream.status}`,
        },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "upstream is not an image" }, { status: 502 });
    }

    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "content-type": contentType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "image proxy failed",
      },
      { status: 502 },
    );
  }
}

function buildSafeReferrer(rawReferrerUrl: string | undefined, imageUrl: URL) {
  if (rawReferrerUrl) {
    try {
      const referrerUrl = new URL(rawReferrerUrl);
      if (isQbitaiHost(referrerUrl.hostname)) return referrerUrl.toString();
    } catch {
      // Fall through to the source homepage for referrer-protected qbitai images.
    }
  }

  return isQbitaiHost(imageUrl.hostname) ? "https://www.qbitai.com/" : imageUrl.origin;
}

function isQbitaiHost(hostname: string) {
  return hostname === "qbitai.com" || hostname.endsWith(".qbitai.com");
}
