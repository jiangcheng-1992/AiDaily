export function validateIngestRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") return null;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is required in production" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
