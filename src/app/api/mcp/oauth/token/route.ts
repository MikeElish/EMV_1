import { exchangeCode, refresh } from "@/lib/mcp/auth";

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const raw = type.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  const field = (name: string) => (typeof raw[name] === "string" ? (raw[name] as string) : "");

  const answer =
    field("grant_type") === "authorization_code"
      ? await exchangeCode({
          code: field("code"),
          verifier: field("code_verifier"),
          clientId: field("client_id"),
          redirectUri: field("redirect_uri"),
        })
      : field("grant_type") === "refresh_token"
        ? await refresh(field("refresh_token"))
        : ({ ok: false, error: "unsupported_grant_type" } as const);

  return answer.ok
    ? Response.json(answer.body, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: answer.error }, { status: 400 });
}
