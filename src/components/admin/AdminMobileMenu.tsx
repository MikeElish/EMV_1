"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/admin/auth";
import { ACCESS_GROUPS, sectionOfPath, type AccessGroup, type AccessMap } from "@/lib/access";
import { MobileMenu, MOBILE_MENU_ITEM } from "@/components/MobileMenu";
import { useMailUnread } from "@/components/mail/useMailUnread";
import { UnreadLabel } from "@/components/mail/UnreadLabel";
import { MAIL_TABS } from "@/components/mail/MailShell";

/** The group and tab of a path, e.g. «CRM · Заказы». */
export function adminLocation(pathname: string): string {
  const section = sectionOfPath(pathname);
  if (!section) return "";
  if (section.key === "mail") {
    const tab = pathname.startsWith("/admin/mail/compose") ? { label: "Написать" } : MAIL_TABS.find((t) => pathname.startsWith(t.href));
    return tab ? `Почта · ${tab.label}` : "Почта";
  }
  const group = ACCESS_GROUPS.find((g) => g.sections.includes(section));
  return group && group.sections.length > 1 ? `${group.label} · ${section.label}` : section.label;
}

/** Phones and tablets: where you are, in the top bar. */
export function AdminLocation() {
  return <span className="min-w-0 truncate text-sm font-medium lg:hidden">{adminLocation(usePathname())}</span>;
}

/**
 * ☰ of the admin on phones and tablets: the menu blocks, each opening into
 * its tabs (☰ → CRM → Заказы). Only what the employee may see.
 */
export function AdminMobileMenu({ access, userLabel }: { access: AccessMap; userLabel: string }) {
  const pathname = usePathname();
  const unread = useMailUnread();
  const current = sectionOfPath(pathname);
  const currentGroup = ACCESS_GROUPS.find((g) => current && g.sections.includes(current));
  const [expanded, setExpanded] = useState<string | null>(currentGroup?.path ?? null);

  const groups = ACCESS_GROUPS.map((g) => ({ ...g, sections: g.sections.filter((s) => access[s.key] !== "hide") })).filter(
    (g) => g.sections.length > 0
  );

  const link = (href: string, label: React.ReactNode, active: boolean, nested = false) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${MOBILE_MENU_ITEM} ${nested ? "pl-8 text-[15px]" : ""} ${
        active ? "bg-foreground/10 font-medium" : nested ? "text-foreground/70" : ""
      }`}
    >
      {label}
    </Link>
  );

  const single = (g: AccessGroup) => {
    const s = g.sections[0];
    return link(s.path, g.label, current?.key === s.key);
  };

  // Почта opens into its folders, like a block into its tabs.
  const mail = () => {
    const open = expanded === "/admin/mail";
    return (
      <div key="/admin/mail">
        <button
          type="button"
          onClick={() => setExpanded(open ? null : "/admin/mail")}
          aria-expanded={open}
          className={`${MOBILE_MENU_ITEM} justify-between ${current?.key === "mail" ? "font-medium" : ""}`}
        >
          <UnreadLabel label="Почта" count={unread?.total} />
          <span aria-hidden className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        {open &&
          [{ href: "/admin/mail/compose", label: "Написать" }, ...MAIL_TABS].map((t) =>
            link(
              t.href,
              "count" in t && t.count ? <UnreadLabel label={t.label} count={unread?.[t.count]} /> : t.label,
              pathname.startsWith(t.href),
              true
            )
          )}
      </div>
    );
  };

  return (
    <MobileMenu className="lg:hidden" title="EMV Админка">
      {() => (
        <>
          {groups.map((g) => {
            if (g.sections[0].key === "mail") return mail();
            if (g.sections.length === 1 && ACCESS_GROUPS.find((x) => x.path === g.path)!.sections.length === 1) return single(g);
            const open = expanded === g.path;
            return (
              <div key={g.path}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : g.path)}
                  aria-expanded={open}
                  className={`${MOBILE_MENU_ITEM} justify-between ${currentGroup?.path === g.path ? "font-medium" : ""}`}
                >
                  {g.label}
                  <span aria-hidden className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>
                {open && g.sections.map((s) => link(s.path, s.label, current?.key === s.key, true))}
              </div>
            );
          })}
          <div className="my-2 border-t border-foreground/10" />
          <p className="truncate px-4 py-2 text-sm text-foreground/50">{userLabel}</p>
          <form action={logout}>
            <button type="submit" className={`${MOBILE_MENU_ITEM} text-red-600`}>
              Выйти
            </button>
          </form>
        </>
      )}
    </MobileMenu>
  );
}
