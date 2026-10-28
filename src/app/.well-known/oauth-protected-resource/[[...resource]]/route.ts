import { protectedResourceMetadata } from "@/lib/mcp/metadata";

// Also answers /.well-known/oauth-protected-resource/api/mcp, the path-suffixed form.
export function GET() {
  return Response.json(protectedResourceMetadata(), { headers: { "Access-Control-Allow-Origin": "*" } });
}
