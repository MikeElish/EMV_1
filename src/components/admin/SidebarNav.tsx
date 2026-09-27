"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд", section: "/admin" },
  { href: "/admin/crm/users", label: "CRM", section: "/admin/crm" },
  { href: "/admin/taxi-fleet/driver-applications", label: "Таксопарк", section: "/admin/taxi-fleet" },
  { href: "/admin/reports", label: "Отчёты", section: "/admin/reports" },
  { href: "/admin/mail", label: "Почта", section: "/admin/mail" },
  { href: "/admin/settings/site", label: "Настройки", section: "/admin/settings" },
];

function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" /> : null;
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex flex-col gap-1 text-sm">
      {NAV_LINKS.map((link) => {
        const active =
          link.section === "/admin" ? pathname === "/admin" : pathname.startsWith(link.section);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className={`flex items-center rounded-md px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground ${
              active ? "bg-foreground/5 text-foreground" : "text-foreground/70"
            }`}
          >
            {link.label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
