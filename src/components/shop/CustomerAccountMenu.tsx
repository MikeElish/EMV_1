"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmEntryButton } from "@/components/CrmEntryButton";
import { DropdownMenu } from "@/components/DropdownMenu";
import { CustomerSettingsModal } from "@/components/shop/CustomerSettingsModal";
import { getCrmBadge, type CrmBadgeInfo } from "@/actions/crm/session-badge";
import { logoutCustomer } from "@/actions/shop/settings";

const LOGGED_OUT: CrmBadgeInfo = { loggedIn: false, label: null, role: null };

export function CustomerAccountMenu({ variant }: { variant: "light" | "dark" }) {
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

  if (badge.role !== "CUSTOMER") {
    return <CrmEntryButton variant={variant} />;
  }

  const surface = variant === "dark" ? "bg-white/5 text-white" : "bg-foreground/5 text-foreground/70";

  async function handleLogout(close: () => void) {
    close();
    await logoutCustomer();
    setBadge(LOGGED_OUT);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu
        label={badge.label ?? ""}
        buttonClassName={`rounded-md border border-green-400 px-3 py-1.5 text-xs transition-opacity hover:opacity-80 ${surface}`}
      >
        {(close) => (
          <>
            <button
              type="button"
              onClick={() => {
                close();
                setSettingsOpen(true);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
            >
              Настройки
            </button>
            <button
              type="button"
              onClick={() => handleLogout(close)}
              className="block w-full px-3 py-2 text-left text-red-600 hover:bg-foreground/5"
            >
              Выход
            </button>
          </>
        )}
      </DropdownMenu>

      {settingsOpen && <CustomerSettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
