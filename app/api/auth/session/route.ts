import { type NextRequest, NextResponse } from "next/server";

import { authSessionCookie, getUserBySession } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(authSessionCookie)?.value;
  const user = await getUserBySession(sessionId);

  return NextResponse.json(
    {
      ok: true,
      user,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
