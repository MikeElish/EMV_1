"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShopLink } from "@/components/shop/ShopLink";
import { getMyBalance } from "@/actions/shop/balance";
import { formatRub } from "@/lib/money";

/** «Баланс» of the signed-in customer: paid less shipped. Read again on each page. */
export function BalanceBadge({ light, className = "" }: { light?: boolean; className?: string }) {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMyBalance()
      .then((b) => !cancelled && setBalance(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  if (balance === null) return null;

  const tone =
    balance > 0
      ? "text-green-700 dark:text-green-400"
      : balance < 0
        ? "text-red-600 dark:text-red-400"
        : light
          ? "text-white/80"
          : "text-foreground/70";
  return (
    <ShopLink
      href="/shop/orders"
      className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs transition-opacity hover:opacity-80 ${
        light ? "border-white/30 bg-white/10" : "border-foreground/20 bg-foreground/5"
      } ${className}`}
    >
      <span
        title={balance > 0 ? "Оплачено больше, чем отгружено (аванс)" : balance < 0 ? "Отгружено больше, чем оплачено (долг)" : "Оплаты и отгрузки сходятся"}
        className={light ? "text-white/70" : "text-foreground/50"}
      >
        Баланс{" "}
      </span>
      <span className={`font-semibold tabular-nums ${light && balance === 0 ? "" : tone} ${light && balance !== 0 ? "drop-shadow" : ""}`}>
        {balance > 0 ? "+" : ""}
        {formatRub(balance)}
      </span>
    </ShopLink>
  );
}
