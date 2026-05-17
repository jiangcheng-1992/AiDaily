import { type NextRequest, NextResponse } from "next/server";

import {
  authSessionCookie,
  getClearAuthCookieOptions,
  logoutUser,
} from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(authSessionCookie)?.value;
  await logoutUser(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(authSessionCookie, "", getClearAuthCookieOptions(request));

  return response;
}
