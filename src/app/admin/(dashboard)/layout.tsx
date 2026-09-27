import { verifyAdminSession, getCurrentAdmin } from "@/lib/admin-dal";
import { logout } from "@/actions/admin/auth";
import { SidebarNav } from "@/components/admin/SidebarNav";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyAdminSession();
  const admin = await getCurrentAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-foreground/10 p-6">
        <p className="font-semibold">EMV Админка</p>
        <SidebarNav />

        <div className="mt-10 border-t border-foreground/10 pt-4 text-xs text-foreground/50">
          <p className="truncate">{admin?.email}</p>
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
