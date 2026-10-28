"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { listPriceRequests, requestPricesForOrder, type PriceRequestView } from "@/actions/admin/price-check";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Проценка → «Запросы КП»: letters to suppliers about orders' lines in
 * «Проверка заказа» -- sent by themselves with a new order, or here by its number.
 */
export function PriceRequestsModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<PriceRequestView[] | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listPriceRequests().then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, []);

  function send() {
    setResult(null);
    startTransition(async () => {
      const r = await requestPricesForOrder(orderNumber);
      setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      setRows(await listPriceRequests());
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-5xl">
      <h2 className="text-lg font-semibold">Запросы КП по почте</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Позиции «Проверка заказа» уходят поставщикам из карточек товаров (на e-mail контактного лица компании) сами при новом
        заказе. Ответ с таблицей вносится в проценку; без ответа через сутки — повторный запрос, через двое — сводка на emv@emv.one.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && orderNumber.trim() && send()}
          placeholder="Номер заказа, напр. 281026/1"
          className="w-60 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !orderNumber.trim()}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Отправляем..." : "Запросить КП"}
        </button>
      </div>
      {result && <p className={`mt-2 text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.text}</p>}

      <div className="mt-4 max-h-[55vh] overflow-auto">
        {rows === null ? (
          <p className="text-sm text-foreground/50">Загрузка...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-foreground/40">Запросов пока не было.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-left text-foreground/50">
                <th className="py-1.5 pr-3">Заказ</th>
                <th className="py-1.5 pr-3">Поставщик</th>
                <th className="py-1.5 pr-3">Отправлен</th>
                <th className="py-1.5 pr-3">Повтор</th>
                <th className="py-1.5 pr-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-foreground/10 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3">{r.orderNumber}</td>
                  <td className="py-1.5 pr-3">
                    {r.supplier}
                    <div className="text-xs text-foreground/50">
                      {r.email} · {r.lines} поз.
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{when(r.sentAt)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{when(r.remindedAt)}</td>
                  <td className="py-1.5 pr-3">
                    {r.answeredAt ? (
                      <span className="text-green-700 dark:text-green-500">КП получено {when(r.answeredAt)}</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">{r.summarySentAt ? "КП не получено" : "Ждём ответ"}</span>
                    )}
                    {r.answerNote && <div className="text-xs text-foreground/50">{r.answerNote}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
