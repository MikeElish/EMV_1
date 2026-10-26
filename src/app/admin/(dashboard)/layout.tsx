import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { logout } from "@/actions/admin/auth";
import { SidebarNav } from "@/components/admin/SidebarNav";
import { ThemeToggle } from "@/components/shop/ThemeToggle";
import { themeInitScript } from "@/lib/theme";
import { getMyAccess } from "@/lib/access-server";
import { resolveAccess } from "@/lib/access";
import { AccessProvider, ViewOnlyBanner } from "@/components/admin/AccessContext";
import { AdminLocation, AdminMobileMenu } from "@/components/admin/AdminMobileMenu";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every employee gets in; the sections open to them (Карточка пользователя
  // → Доступ) are guarded by src/proxy.ts and by each server action.
  const session = await verifyStaffSession();
  const [user, me] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, login: true },
    }),
    getMyAccess(),
  ]);
  const access = me?.access ?? resolveAccess(session.role, null);

  // The window is split in fixed parts: the sidebar and the top bar never
  // move, only <main> scrolls (CRM tables scroll inside their own frame).
  return (
    <div
      id="admin-root"
      suppressHydrationWarning
      className="flex h-dvh overflow-hidden bg-background text-foreground"
    >
      <script dangerouslySetInnerHTML={{ __html: themeInitScript("admin") }} />

      {/* Phones and tablets: no sidebar -- the menu is behind ☰ in the top bar. */}
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-foreground/10 p-6 lg:block">
        <p className="font-semibold">EMV Админка</p>
        <SidebarNav access={access} />

        <div className="mt-10 border-t border-foreground/10 pt-4 text-xs text-foreground/50">
          <p className="truncate">{user?.email ?? user?.login}</p>
          <form action={logout} className="mt-2">
            <button type="submit" className="underline underline-offset-4">
              Выйти
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-foreground/10 px-4 lg:justify-end lg:px-8">
          <AdminMobileMenu access={access} userLabel={user?.email ?? user?.login ?? ""} />
          <AdminLocation />
          <div className="ml-auto lg:ml-0">
            <ThemeToggle scope="admin" />
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-6 pt-4 [scrollbar-gutter:stable] lg:px-8 lg:pb-8 lg:pt-6">
          <AccessProvider access={access}>
            <ViewOnlyBanner />
            {children}
          </AccessProvider>
        </main>
      </div>
    </div>
  );
}
