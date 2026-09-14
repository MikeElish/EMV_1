import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "emv_admin_session";
// Staff/CRM users expect to stay logged in across browser restarts until
// they explicitly log out, so this is intentionally long-lived rather than
// a short "session" cookie. Both the cookie and the JWT's own "exp" claim
// are derived from this single constant so they can never drift apart.
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

type SessionPayload = {
  userId: string;
  role: Role;
  login: string;
  expiresAt: string;
};

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_DURATION_MS) / 1000))
    .sign(getSecretKey());
}

export async function decryptSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createAdminSession(userId: string, role: Role, login: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encryptSession({ userId, role, login, expiresAt: expiresAt.toISOString() });
  // A "Secure" cookie is silently dropped by the browser over plain HTTP,
  // so this can't just key off NODE_ENV -- it has to reflect the scheme the
  // request actually arrived over (Nginx sets x-forwarded-proto). That way
  // login keeps working before SSL is set up, and tightens itself
  // automatically once the site moves to HTTPS.
  const headersList = await headers();
  const isHttps = headersList.get("x-forwarded-proto") === "https";
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decryptSession(token);
}

export { SESSION_COOKIE };
