import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { firstVisible, groupOfRoot, resolveAccess, sectionOfPath } from "@/lib/access";

const PUBLIC_ADMIN_PATHS = ["/admin/setup"];

/** Where an employee goes instead of this page -- null: the page is open to them. */
async function staffRedirect(userId: string, pathname: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, access: true } });
  if (!user || user.role === "CUSTOMER") return "/crm";
  const template = await prisma.roleAccess.findUnique({ where: { role: user.role } });
  const access = resolveAccess(user.role, user.access, template?.access);
  const anywhere = firstVisible(access) ?? "/crm/cabinet";
  const group = groupOfRoot(pathname);
  if (group) return firstVisible(access, group) ?? anywhere;
  const section = sectionOfPath(pathname);
  if (section && access[section.key] === "hide") return anywhere;
  return null;
}

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
    if (session.role === "CUSTOMER") {
      return NextResponse.redirect(new URL("/crm/cabinet", request.url));
    }
    // Other employees see what Карточка пользователя → Доступ opens to them
    // (server actions check it again on their own).
    if (session.role !== "OWNER") {
      const target = await staffRedirect(session.userId, pathname);
      if (target) return NextResponse.redirect(new URL(target, request.url));
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
