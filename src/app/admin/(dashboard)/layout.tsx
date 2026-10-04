import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { logout } from "@/actions/admin/auth";
import { SidebarNav } from "@/components/admin/SidebarNav";
import { ThemeToggle } from "@/components/shop/ThemeToggle";
import { themeInitScript } from "@/lib/theme";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every employee gets in (for Почта); the owner-only sections are guarded
  // by src/proxy.ts and verifyAdminSession in their actions.
  const session = await verifyStaffSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, login: true },
  });

  // The window is split in fixed parts: the sidebar and the top bar never
  // move, only <main> scrolls (CRM tables scroll inside their own frame).
  return (
    <div
      id="admin-root"
      suppressHydrationWarning
      className="flex h-dvh overflow-hidden bg-background text-foreground"
    >
      <script dangerouslySetInnerHTML={{ __html: themeInitScript("admin") }} />

      <aside className="w-56 shrink-0 overflow-y-auto border-r border-foreground/10 p-6">
        <p className="font-semibold">EMV Админка</p>
        <SidebarNav isOwner={session.role === "OWNER"} />

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
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-foreground/10 px-8">
          <ThemeToggle scope="admin" />
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-auto px-8 pb-8 pt-6 [scrollbar-gutter:stable]">{children}</main>
      </div>
    </div>
  );
}
