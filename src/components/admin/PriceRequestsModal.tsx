"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import {
  applyPriceReplyReview,
  listPriceRequests,
  requestPricesForOrder,
  type PriceRequestView,
} from "@/actions/admin/price-check";

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
  const [reviewResult, setReviewResult] = useState<{ id: string; ok: boolean; text: string } | null>(null);
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

  function review(event: FormEvent<HTMLFormElement>, request: PriceRequestView) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = request.replyCandidates.map((candidate) => ({
      productId: candidate.productId,
      priceRub: String(form.get(`price-${candidate.productId}`) ?? ""),
      deliveryDays: String(form.get(`days-${candidate.productId}`) ?? ""),
    }));
    setReviewResult(null);
    startTransition(async () => {
      const action = await applyPriceReplyReview(request.id, lines);
      setReviewResult({
        id: request.id,
        ok: action.ok,
        text: action.ok ? "Ответ проверен." : action.error,
      });
      if (action.ok) setRows(await listPriceRequests());
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
                      r.answerBody && !r.answerReviewedAt ? (
                        <span className="text-amber-700 dark:text-amber-400">Ответ в письме — требуется проверка</span>
                      ) : r.answerReviewedAt ? (
                        <span className="text-green-700 dark:text-green-500">Ответ проверен {when(r.answerReviewedAt)}</span>
                      ) : (
                        <span className="text-green-700 dark:text-green-500">КП получено {when(r.answeredAt)}</span>
                      )
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">{r.summarySentAt ? "КП не получено" : "Ждём ответ"}</span>
                    )}
                    {r.answerNote && <div className="text-xs text-foreground/50">{r.answerNote}</div>}
                    {r.answerBody && (
                      <details className="mt-2 max-w-xl">
                        <summary className="cursor-pointer text-xs underline underline-offset-2">
                          Проверить текст ответа
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-foreground/5 p-2 text-xs">
                          {r.answerBody}
                        </pre>
                        <form onSubmit={(event) => review(event, r)} className="mt-2 space-y-2">
                          {r.replyCandidates.length ? (
                            <>
                              <p className="text-xs text-foreground/60">
                                Найдены возможные цены. Проверьте сумму и срок перед внесением в проценку.
                              </p>
                              {r.replyCandidates.map((candidate) => (
                                <div
                                  key={candidate.productId}
                                  className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] items-center gap-2 text-xs"
                                >
                                  <span className="min-w-0 truncate" title={`${candidate.name} · ${candidate.sku}`}>
                                    {candidate.name} · {candidate.sku}
                                  </span>
                                  <label className="flex items-center gap-1">
                                    <input
                                      name={`price-${candidate.productId}`}
                                      type="text"
                                      inputMode="decimal"
                                      required
                                      defaultValue={(candidate.price / 100).toFixed(2).replace(".", ",")}
                                      aria-label={`Цена, ₽: ${candidate.sku}`}
                                      className="w-full rounded border border-foreground/20 bg-transparent px-1.5 py-1 text-right"
                                    />
                                    ₽
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      name={`days-${candidate.productId}`}
                                      type="number"
                                      min="0"
                                      max="365"
                                      defaultValue={candidate.deliveryDays ?? ""}
                                      aria-label={`Срок поставки, дней: ${candidate.sku}`}
                                      className="w-full rounded border border-foreground/20 bg-transparent px-1.5 py-1 text-right"
                                    />
                                    дн.
                                  </label>
                                </div>
                              ))}
                            </>
                          ) : (
                            <p className="text-xs text-foreground/60">
                              Цены по артикулам из запроса не распознаны. Проверьте условия и отметьте ответ как просмотренный.
                            </p>
                          )}
                          {reviewResult?.id === r.id && (
                            <p className={`text-xs ${reviewResult.ok ? "text-green-700" : "text-red-600"}`}>
                              {reviewResult.text}
                            </p>
                          )}
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                          >
                            {pending
                              ? "Сохраняем..."
                              : r.replyCandidates.length
                                ? "Внести проверенные цены"
                                : "Отметить проверенным"}
                          </button>
                        </form>
                      </details>
                    )}
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
