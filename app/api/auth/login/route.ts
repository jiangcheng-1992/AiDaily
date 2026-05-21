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
    // #region debug-point D:login-route-error
    (()=>{const fs=require("node:fs");let u="http://127.0.0.1:7777/event",s="auth-login-failure";try{const e=fs.readFileSync(".dbg/auth-login-failure.env","utf8");u=e.match(/DEBUG_SERVER_URL=(.+)/)?.[1]||u;s=e.match(/DEBUG_SESSION_ID=(.+)/)?.[1]||s}catch{}fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:s,runId:"pre-fix",hypothesisId:"D",location:"app/api/auth/login/route.ts:catch",msg:"[DEBUG] login route failed",data:{error:error instanceof Error ? error.message : "unknown",host:request.headers.get("host"),origin:request.headers.get("origin")},ts:Date.now()})}).catch(()=>{})})();
    // #endregion
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "登录失败，请稍后重试",
      },
      { status: 401 },
    );
  }
}
