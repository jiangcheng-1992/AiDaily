import { type NextRequest, NextResponse } from "next/server";

import {
  authSessionCookie,
  getAuthPersistenceInfo,
  getUserBySession,
} from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(authSessionCookie)?.value;
  const user = await getUserBySession(sessionId);
  const persistence = getAuthPersistenceInfo();

  return NextResponse.json(
    {
      ok: true,
      user,
      persistence,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
