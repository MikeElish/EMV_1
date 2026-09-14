"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CrmEntryButton } from "@/components/CrmEntryButton";
import { CartIcon } from "@/components/shop/CartIcon";
import { ThemeToggle } from "@/components/shop/ThemeToggle";
import { HeaderSearchBar } from "@/components/shop/HeaderSearchBar";

export function ShopHeader() {
  // На главной странице фон — видео в баннере, поэтому шапка там
  // прозрачная и плавает поверх него; на остальных страницах видео нет,
  // и шапке нужен непрозрачный фон, чтобы текст оставался читаемым.
  const isHome = usePathname() === "/shop";

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
        <CrmEntryButton variant={isHome ? "dark" : "light"} />
      </div>
    </header>
  );
}
