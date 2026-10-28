"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useMailUnread } from "@/components/mail/useMailUnread";
import { UnreadLabel } from "@/components/mail/UnreadLabel";
import { ACCESS_GROUPS, firstVisible, sectionOfPath, type AccessMap } from "@/lib/access";
import { useAdminPlaces } from "@/components/admin/AdminPlaces";

// One link per group: to the page last open in it, else its first section open to the employee.

function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" /> : null;
}

export function SidebarNav({ access }: { access: AccessMap }) {
  const pathname = usePathname();
  const unread = useMailUnread();
  const place = useAdminPlaces();
  // The sidebar is outside AccessProvider: the map comes as a prop.
  const visible = (href: string) => {
    const section = sectionOfPath(href);
    return !!section && access[section.key] !== "hide";
  };

  return (
    <nav className="mt-6 flex flex-col gap-1 text-sm">
      {ACCESS_GROUPS.flatMap((group) => {
        const href = firstVisible(access, group);
        const last = place(group.path);
        return href ? [{ href: last !== group.path && visible(last.split("?")[0]) ? last : href, label: group.label, section: group.path }] : [];
      }).map((link) => {
        const active =
          link.section === "/admin" ? pathname === "/admin" : pathname.startsWith(link.section);
        return (
          <Link
            key={link.section}
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
