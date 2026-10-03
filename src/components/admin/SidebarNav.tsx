"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useMailUnread } from "@/components/mail/useMailUnread";
import { UnreadLabel } from "@/components/mail/UnreadLabel";

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд", section: "/admin", ownerOnly: true },
  { href: "/admin/crm/users", label: "CRM", section: "/admin/crm", ownerOnly: true },
  { href: "/admin/taxi-fleet/driver-applications", label: "Таксопарк", section: "/admin/taxi-fleet", ownerOnly: true },
  { href: "/admin/reports", label: "Отчёты", section: "/admin/reports", ownerOnly: true },
  { href: "/admin/mail", label: "Почта", section: "/admin/mail", ownerOnly: false },
  { href: "/admin/settings/site", label: "Настройки", section: "/admin/settings", ownerOnly: true },
];

function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" /> : null;
}

export function SidebarNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const unread = useMailUnread();

  return (
    <nav className="mt-6 flex flex-col gap-1 text-sm">
      {NAV_LINKS.filter((link) => isOwner || !link.ownerOnly).map((link) => {
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
            {link.section === "/admin/mail" ? (
              <UnreadLabel label={link.label} count={unread?.total} />
            ) : (
              link.label
            )}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
