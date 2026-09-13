import Link from "next/link";
import { verifyAdminSession, getCurrentAdmin } from "@/lib/admin-dal";
import { logout } from "@/actions/admin/auth";

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/driver-applications", label: "Заявки водителей" },
  { href: "/admin/search", label: "Поиск" },
];

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
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

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
