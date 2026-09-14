"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCrmBadge, type CrmBadgeInfo } from "@/actions/crm/session-badge";

const LOGGED_OUT: CrmBadgeInfo = { loggedIn: false, label: null };

export function CrmEntryButton({ variant }: { variant: "light" | "dark" }) {
  const [badge, setBadge] = useState<CrmBadgeInfo>(LOGGED_OUT);

  useEffect(() => {
    let cancelled = false;
    getCrmBadge().then((result) => {
      if (!cancelled) setBadge(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const surface =
    variant === "dark" ? "bg-white/5 text-white" : "bg-foreground/5 text-foreground/70";
  const border = badge.loggedIn
    ? "border-green-400"
    : variant === "dark"
      ? "border-white/30"
      : "border-foreground/20";

  return (
    <Link
      href="/crm"
      className={`rounded-md border px-3 py-1.5 text-xs transition-opacity hover:opacity-80 ${surface} ${border}`}
    >
      {badge.loggedIn ? badge.label : "Вход в CRM"}
    </Link>
  );
}
