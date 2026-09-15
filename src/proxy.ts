import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_ADMIN_PATHS = ["/admin/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (pathname.startsWith("/admin")) {
    const isPublicPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    if (isPublicPath) return NextResponse.next();

    if (!session?.userId) {
      return NextResponse.redirect(new URL("/crm", request.url));
    }
    if (session.role !== "OWNER") {
      return NextResponse.redirect(new URL("/crm/cabinet", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/crm")) {
    if (pathname === "/crm/cabinet") {
      if (!session?.userId) {
        return NextResponse.redirect(new URL("/crm", request.url));
      }
      if (session.role === "CUSTOMER") {
        return NextResponse.redirect(new URL("/shop", request.url));
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/crm/:path*"],
};
