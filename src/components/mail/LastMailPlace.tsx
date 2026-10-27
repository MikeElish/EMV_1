"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Почта opens where the employee left it (folder, list page, open letter);
// the first time — Входящие. Kept in this browser, per employee.

const INBOX = "/admin/mail/inbox";
const storageKey = (userId: string) => `emv-mail-last:${userId}`;

/** Inside the mail section: remembers the current place (not «Написать» — an unsent letter isn't restored). */
export function RememberMailPlace({ userId }: { userId: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (!pathname.startsWith("/admin/mail/") || pathname.startsWith("/admin/mail/compose")) return;
    try {
      localStorage.setItem(storageKey(userId), search ? `${pathname}?${search}` : pathname);
    } catch {
      // storage unavailable: Почта just opens Входящие
    }
  }, [pathname, search, userId]);
  return null;
}

/** /admin/mail: goes to the remembered place, or Входящие. */
export function OpenLastMailPlace({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    let target = INBOX;
    try {
      const saved = localStorage.getItem(storageKey(userId));
      if (saved?.startsWith("/admin/mail/")) target = saved;
    } catch {
      // storage unavailable
    }
    router.replace(target);
  }, [router, userId]);
  return <p className="py-24 text-center text-sm text-foreground/50">Открываем почту…</p>;
}
