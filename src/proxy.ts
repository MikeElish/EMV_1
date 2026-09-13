import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (!isPublicPath && !session?.adminId) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname === "/admin/login" && session?.adminId) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
