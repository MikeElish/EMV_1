import "server-only";
import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

// OAuth 2.1 for the Claude connector (claude.ai → Настройки → Коннекторы):
// Claude registers itself, sends the owner to /admin/connect, gets a code
// and trades it (with PKCE) for tokens. Nothing is stored: codes and tokens
// are signed with SESSION_SECRET, and every call checks that the user is
// still the owner.

const CODE_TTL = 5 * 60;
const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

/** Where Claude may be sent back with a code. */
const REDIRECT_HOSTS = ["claude.ai", "claude.com"];

export const MCP_RESOURCE = () => absoluteUrl("/api/mcp");

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(`mcp-oauth:${secret}`);
}

type Kind = "client" | "code" | "access" | "refresh";

async function sign(kind: Kind, claims: Record<string, unknown>, ttl: number | null) {
  const jwt = new SignJWT({ ...claims, kind }).setProtectedHeader({ alg: "HS256" }).setIssuedAt();
  if (ttl) jwt.setExpirationTime(Math.floor(Date.now() / 1000) + ttl);
  return jwt.sign(key());
}

async function verify(kind: Kind, token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.kind === kind ? payload : null;
  } catch {
    return null;
  }
}

export function allowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
    return url.protocol === "https:" && REDIRECT_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Dynamic client registration: the client id carries its redirect URIs. */
export async function registerClient(name: string, redirectUris: string[]) {
  return sign("client", { name: name.slice(0, 100), redirectUris }, null);
}

export async function readClient(clientId: string) {
  const c = await verify("client", clientId);
  if (!c || !Array.isArray(c.redirectUris)) return null;
  return { name: String(c.name ?? "Claude"), redirectUris: c.redirectUris.map(String) };
}

export async function issueCode(p: { userId: string; clientId: string; redirectUri: string; challenge: string }) {
  return sign("code", p, CODE_TTL);
}

const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

async function isOwner(userId: unknown) {
  if (typeof userId !== "string") return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "OWNER";
}

async function tokens(userId: string) {
  return {
    access_token: await sign("access", { userId }, ACCESS_TTL),
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: await sign("refresh", { userId }, REFRESH_TTL),
  };
}

export type TokenAnswer = { ok: true; body: Awaited<ReturnType<typeof tokens>> } | { ok: false; error: string };

export async function exchangeCode(p: { code: string; verifier: string; clientId: string; redirectUri: string }): Promise<TokenAnswer> {
  const c = await verify("code", p.code);
  if (!c || c.clientId !== p.clientId || c.redirectUri !== p.redirectUri) return { ok: false, error: "invalid_grant" };
  if (!p.verifier || s256(p.verifier) !== c.challenge) return { ok: false, error: "invalid_grant" };
  if (!(await isOwner(c.userId))) return { ok: false, error: "invalid_grant" };
  return { ok: true, body: await tokens(c.userId as string) };
}

export async function refresh(token: string): Promise<TokenAnswer> {
  const c = await verify("refresh", token);
  if (!c || !(await isOwner(c.userId))) return { ok: false, error: "invalid_grant" };
  return { ok: true, body: await tokens(c.userId as string) };
}

/** The owner's id from «Authorization: Bearer …», or null. */
export async function bearerUser(header: string | null): Promise<string | null> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const c = await verify("access", token);
  return c && (await isOwner(c.userId)) ? (c.userId as string) : null;
}
