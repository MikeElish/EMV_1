import "server-only";
import { absoluteUrl } from "@/lib/site";
import { MCP_RESOURCE } from "@/lib/mcp/auth";

/** RFC 9728: where the connector's tokens come from. */
export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE(),
    authorization_servers: [absoluteUrl("/")],
    bearer_methods_supported: ["header"],
    resource_name: "EMV",
  };
}

/** RFC 8414: the OAuth endpoints of the site. */
export function authorizationServerMetadata() {
  return {
    issuer: absoluteUrl("/"),
    authorization_endpoint: absoluteUrl("/admin/connect"),
    token_endpoint: absoluteUrl("/api/mcp/oauth/token"),
    registration_endpoint: absoluteUrl("/api/mcp/oauth/register"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}
