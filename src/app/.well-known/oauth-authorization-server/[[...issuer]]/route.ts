import { authorizationServerMetadata } from "@/lib/mcp/metadata";

export function GET() {
  return Response.json(authorizationServerMetadata(), { headers: { "Access-Control-Allow-Origin": "*" } });
}
