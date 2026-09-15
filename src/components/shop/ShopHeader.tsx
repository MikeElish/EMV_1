"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CrmEntryButton } from "@/components/CrmEntryButton";
import { CartIcon } from "@/components/shop/CartIcon";
import { ThemeToggle } from "@/components/shop/ThemeToggle";
import { HeaderSearchBar } from "@/components/shop/HeaderSearchBar";
import { getCrmBadge } from "@/actions/crm/session-badge";

export function ShopHeader() {
  // На главной странице фон — видео в баннере, поэтому шапка там
  // прозрачная и плавает поверх него; на остальных страницах видео нет,
  // и шапке нужен непрозрачный фон, чтобы текст оставался читаемым.
  const isHome = usePathname() === "/shop";

  const [isCustomer, setIsCustomer] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getCrmBadge().then((badge) => {
      if (!cancelled) setIsCustomer(badge.role === "CUSTOMER");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className={
        isHome
          ? "absolute inset-x-0 top-0 z-10 border-b border-white/15 bg-transparent"
          : "relative border-b border-foreground/10 bg-background"
      }
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <div
          className={`flex items-center gap-2 ${isHome ? "text-white" : ""}`}
        >
          <Link href="/" aria-label="На начальную страницу EMV">
            <Logo className="h-8 w-8" />
          </Link>
          <Link href="/shop" className="font-semibold">
            EMV Запчасти
          </Link>
        </div>

        <HeaderSearchBar isHome={isHome} />

        <CartIcon light={isHome} />
        <ThemeToggle light={isHome} />
        {isCustomer && (
          <Link
            href="/shop/orders"
            className={`rounded-md border px-3 py-1.5 text-xs transition-opacity hover:opacity-80 ${
              isHome
                ? "border-white/30 bg-white/5 text-white"
                : "border-foreground/20 bg-foreground/5 text-foreground/70"
            }`}
          >
            Мои заказы
          </Link>
        )}
        <CrmEntryButton variant={isHome ? "dark" : "light"} />
      </div>
    </header>
  );
}
