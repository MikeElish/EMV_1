import { allowedRedirect, registerClient } from "@/lib/mcp/auth";

// RFC 7591: Claude registers itself before the first sign-in.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!redirectUris.length || !redirectUris.every(allowedRedirect)) {
    return Response.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }
  const name = typeof body?.client_name === "string" ? body.client_name : "Claude";
  return Response.json(
    {
      client_id: await registerClient(name, redirectUris),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
