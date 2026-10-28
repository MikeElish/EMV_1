"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { orderPaymentStatus, payOrderBySbp } from "@/actions/shop/payments";
import { formatRub } from "@/lib/money";

/** «Оплатить по СБП» -- and, back from the bank's page, whether the payment went through. */
export function SbpPayButton({ orderNumber, amount, returnedPaymentId }: { orderNumber: string; amount: number | null; returnedPaymentId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"checking" | "paid" | "pending" | "failed" | null>(returnedPaymentId ? "checking" : null);

  useEffect(() => {
    if (!returnedPaymentId) return;
    let cancelled = false;
    let tries = 0;
    const look = async () => {
      const status = await orderPaymentStatus(orderNumber, returnedPaymentId).catch(() => "pending" as const);
      if (cancelled) return;
      // The bank may confirm a few seconds after the return.
      if (status === "pending" && ++tries < 6) {
        setTimeout(look, 5000);
        return;
      }
      setState(status);
      if (status === "paid") router.refresh();
    };
    void look();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, returnedPaymentId, router]);

  async function pay() {
    setBusy(true);
    setError(null);
    const result = await payOrderBySbp(orderNumber);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="mt-6">
      {state === "checking" && <p className="text-sm text-foreground/60">Проверяем оплату…</p>}
      {state === "paid" && <p className="text-sm font-medium text-green-700 dark:text-green-500">Оплата получена. Чек придёт на вашу почту.</p>}
      {state === "pending" && <p className="text-sm text-foreground/60">Банк ещё не подтвердил оплату — статус заказа обновится в течение нескольких минут.</p>}
      {state === "failed" && <p className="text-sm text-red-600">Оплата не прошла. Можно попробовать ещё раз.</p>}
      {amount !== null && state !== "paid" && state !== "checking" && (
        <>
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="mt-3 w-full rounded-md bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Переходим к оплате…" : `Оплатить по СБП ${formatRub(amount)}`}
          </button>
          <p className="mt-2 text-center text-xs text-foreground/50">Оплата через приложение вашего банка по QR-коду или ссылке.</p>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
