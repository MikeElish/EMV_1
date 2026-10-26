"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileMenu, MOBILE_MENU_ITEM } from "@/components/MobileMenu";
import { CustomerSettingsModal } from "@/components/shop/CustomerSettingsModal";
import { getCrmBadge, type CrmBadgeInfo } from "@/actions/crm/session-badge";
import { logoutCustomer } from "@/actions/shop/settings";

const LOGGED_OUT: CrmBadgeInfo = { loggedIn: false, label: null, role: null };

/** ☰ of the shop on phones: the account part of the header. */
export function ShopMobileMenu({ light }: { light: boolean }) {
  const router = useRouter();
  const [badge, setBadge] = useState<CrmBadgeInfo>(LOGGED_OUT);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCrmBadge().then((result) => {
      if (!cancelled) setBadge(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const customer = badge.role === "CUSTOMER";

  return (
    <>
      <MobileMenu light={light} className="sm:hidden" title="EMV Запчасти">
        {(close) => (
          <>
            {badge.loggedIn && (
              <p className="truncate px-4 pb-2 pt-1 text-sm text-foreground/50">{badge.label}</p>
            )}
            <Link href="/shop" className={MOBILE_MENU_ITEM}>
              Каталог
            </Link>
            <Link href="/shop/cart" className={MOBILE_MENU_ITEM}>
              Корзина
            </Link>
            {customer && (
              <>
                <Link href="/shop/orders" className={MOBILE_MENU_ITEM}>
                  Мои заказы
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setSettingsOpen(true);
                  }}
                  className={MOBILE_MENU_ITEM}
                >
                  Настройки
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    close();
                    await logoutCustomer();
                    setBadge(LOGGED_OUT);
                    router.refresh();
                  }}
                  className={`${MOBILE_MENU_ITEM} text-red-600`}
                >
                  Выход
                </button>
              </>
            )}
            {!badge.loggedIn && (
              <>
                <Link href="/crm" className={MOBILE_MENU_ITEM}>
                  Вход
                </Link>
                <Link href="/crm/register" className={MOBILE_MENU_ITEM}>
                  Регистрация
                </Link>
              </>
            )}
            {badge.loggedIn && !customer && (
              <Link href="/crm" className={MOBILE_MENU_ITEM}>
                В CRM
              </Link>
            )}
            <div className="my-2 border-t border-foreground/10" />
            <Link href="/" className={`${MOBILE_MENU_ITEM} text-foreground/60`}>
              На главную EMV
            </Link>
          </>
        )}
      </MobileMenu>
      {settingsOpen && <CustomerSettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
