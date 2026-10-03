"use client";

import { useRouter } from "next/navigation";
import { PRODUCTS_RETURN_KEY } from "@/components/admin/products-return";

/** Back to the page the card was opened from; the list restores its place itself. */
export function ProductBackButton() {
  const router = useRouter();

  function back() {
    let fromList = false;
    try {
      fromList = sessionStorage.getItem(PRODUCTS_RETURN_KEY) !== null;
    } catch {
      // ignore unavailable storage
    }
    if (fromList && window.history.length > 1) router.back();
    else router.push("/admin/crm/products");
  }

  return (
    <button
      type="button"
      onClick={back}
      className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
    >
      <span aria-hidden>←</span> Назад
    </button>
  );
}
