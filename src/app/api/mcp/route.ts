import { absoluteUrl } from "@/lib/site";
import { bearerUser } from "@/lib/mcp/auth";
import { TOOLS, runTool } from "@/lib/mcp/tools";

// The Claude connector: MCP over Streamable HTTP, stateless, plain JSON
// answers (no SSE). Sign-in: src/lib/mcp/auth.ts.

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const INSTRUCTIONS =
  "Сайт EMV (emv.one): магазин запчастей и CRM. Цены в рублях. Перед созданием заказа найдите клиента (find_clients) и товары (search_products), " +
  "покажите create_order с preview=true и создавайте только после подтверждения. Смена статуса отправляет клиенту письмо.";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${absoluteUrl("/.well-known/oauth-protected-resource")}"`,
    },
  });
}

async function answer(req: RpcRequest) {
  const result = (value: unknown) => ({ jsonrpc: "2.0", id: req.id, result: value });
  switch (req.method) {
    case "initialize": {
      const asked = String(req.params?.protocolVersion ?? "");
      return result({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "emv", title: "EMV", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result({});
    // Asked by clients that probe every list; the site offers tools only.
    case "resources/list":
      return result({ resources: [] });
    case "resources/templates/list":
      return result({ resourceTemplates: [] });
    case "prompts/list":
      return result({ prompts: [] });
    case "tools/list":
      return result({
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: !!t.readOnly, destructiveHint: false },
        })),
      });
    case "tools/call":
      return result(await runTool(String(req.params?.name ?? ""), (req.params?.arguments ?? {}) as Record<string, unknown>));
    default:
      return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }
}

export async function POST(request: Request) {
  if (!(await bearerUser(request.headers.get("authorization")))) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });

  const batch: RpcRequest[] = Array.isArray(body) ? body : [body];
  const answers = [];
  for (const req of batch) {
    // Notifications (no id) get no answer.
    if (req.id === undefined || req.id === null) continue;
    answers.push(await answer(req));
  }
  if (!answers.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? answers : answers[0]);
}

// No server-initiated stream and no sessions.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
