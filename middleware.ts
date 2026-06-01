import { type NextRequest, NextResponse } from "next/server";

const canonicalHost = "aiquan.me";
const legacyHosts = new Set([
  "aidaily-production.up.railway.app",
]);

const blockedPathPatterns = [
  /^\/wp-admin(?:\/|$)/i,
  /^\/wp-login\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/phpmyadmin(?:\/|$)/i,
  /^\/\.env$/i,
  /^\/\.git(?:\/|$)/i,
  /^\/vendor(?:\/|$)/i,
];

export function middleware(request: NextRequest) {
  const redirectResponse = redirectLegacyHost(request);
  if (redirectResponse) {
    return redirectResponse;
  }

  if (isBlockedPath(request.nextUrl.pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, request);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};

function redirectLegacyHost(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || !legacyHosts.has(host)) return null;

  const targetUrl = request.nextUrl.clone();
  targetUrl.protocol = "https:";
  targetUrl.host = canonicalHost;
  return NextResponse.redirect(targetUrl, 301);
}

function isBlockedPath(pathname: string) {
  return blockedPathPatterns.some((pattern) => pattern.test(pathname));
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
  );
  response.headers.set("x-dns-prefetch-control", "on");

  if (isHttps) {
    response.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}
