import { NextResponse } from "next/server";

import {
  authSessionCookie,
  getAuthCookieOptions,
  registerUser,
} from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const { user, sessionId } = await registerUser({
      email: body.email ?? "",
      password: body.password ?? "",
      name: body.name,
    });
    const response = NextResponse.json({ ok: true, user });

    response.cookies.set(authSessionCookie, sessionId, getAuthCookieOptions(request));
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "注册失败，请稍后重试",
      },
      { status: 400 },
    );
  }
}
