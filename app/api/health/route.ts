export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    service: "ai-circle",
    checkedAt: new Date().toISOString(),
  });
}
