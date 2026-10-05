"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useMailUnread } from "@/components/mail/useMailUnread";
import { UnreadLabel } from "@/components/mail/UnreadLabel";
import { ACCESS_GROUPS, firstVisible, type AccessMap } from "@/lib/access";

// One link per group, to its first section open to the employee.

function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" /> : null;
}

export function SidebarNav({ access }: { access: AccessMap }) {
  const pathname = usePathname();
  const unread = useMailUnread();

  return (
    <nav className="mt-6 flex flex-col gap-1 text-sm">
      {ACCESS_GROUPS.flatMap((group) => {
        const href = firstVisible(access, group);
        return href ? [{ href, label: group.label, section: group.path }] : [];
      }).map((link) => {
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
