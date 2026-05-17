import { NextResponse } from "next/server";

import { authSessionCookie, getAuthCookieOptions, loginUser } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const { user, sessionId } = await loginUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    const response = NextResponse.json({ ok: true, user });

    response.cookies.set(authSessionCookie, sessionId, getAuthCookieOptions(request));
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "登录失败，请稍后重试",
      },
      { status: 401 },
    );
  }
}
