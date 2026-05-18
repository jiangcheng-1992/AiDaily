import {
  authoritativeSources,
  autoIngestSources,
  fetchableSources,
} from "@/lib/ai-sources";

export function GET() {
  return Response.json({
    ok: true,
    total: authoritativeSources.length,
    fetchable: fetchableSources.length,
    autoIngest: autoIngestSources.length,
    sources: authoritativeSources,
  });
}
