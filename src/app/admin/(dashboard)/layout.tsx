import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { logout } from "@/actions/admin/auth";
import { SidebarNav } from "@/components/admin/SidebarNav";

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-foreground/10 p-6">
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

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
