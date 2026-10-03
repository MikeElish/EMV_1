"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useMailUnread, useRefreshMailUnreadOn } from "@/components/mail/useMailUnread";
import { UnreadLabel } from "@/components/mail/UnreadLabel";
import type { UnreadCounts } from "@/lib/mail/unread";

const TABS: { href: string; label: string; count?: keyof UnreadCounts }[] = [
  { href: "/admin/mail/inbox", label: "Входящие", count: "inbox" },
  { href: "/admin/mail/folders", label: "Мои папки", count: "folders" },
  { href: "/admin/mail/sent", label: "Отправленные", count: "sent" },
  { href: "/admin/mail/spam", label: "Спам", count: "junk" },
  { href: "/admin/mail/drafts", label: "Черновики", count: "drafts" },
  { href: "/admin/mail/settings", label: "Настройки" },
];

function TabIndicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (!active && !pending) return null;
  return (
    <span
      aria-hidden
      className={`absolute inset-x-0 -bottom-px h-0.5 ${pending ? "animate-pulse bg-foreground/40" : "bg-foreground"}`}
    />
  );
}

export function MailShell({ configured, children }: { configured: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const unread = useMailUnread();
  useRefreshMailUnreadOn(pathname);

  if (!configured && !pathname.startsWith("/admin/mail/settings")) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold">Почта не настроена</p>
        <Link
          href="/admin/mail/settings?section=programs"
          className="rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Перейти в настройки
        </Link>
      </div>
    );
  }

  // The section fills the window (main has 2rem padding top and bottom):
  // tabs and toolbars stay put, only the letter / folder lists scroll.
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex shrink-0 items-end gap-6 border-b border-foreground/10">
        {/* Each tab is an IMAP round-trip, so no background prefetch here. */}
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={`relative px-1 pb-3 text-sm font-medium transition-colors ${
                active ? "text-foreground" : "text-foreground/50 hover:text-foreground"
              }`}
            >
              <UnreadLabel label={tab.label} count={tab.count ? unread?.[tab.count] : undefined} />
              <TabIndicator active={active} />
            </Link>
          );
        })}
        {configured && (
          <Link
            href="/admin/mail/compose"
            prefetch={false}
            className="mb-2 ml-auto rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Написать
          </Link>
        )}
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
