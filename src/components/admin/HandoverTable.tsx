"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { formatRub } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { handOver } from "@/actions/admin/receipts";
import { HANDOVER_KINDS, type HandoverKind } from "@/lib/validators/receipts";

export type HandoverRow = {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  delivery: string | null;
  ready: { name: string; quantity: number }[];
  readySum: number;
  linesTotal: number;
  payment: string;
  handover: string | null;
  handoverAt: string | null;
  handoverNote: string | null;
  waybills: { id: string; fileName: string; fileUrl: string }[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";

const STATE_STYLES: Record<string, string> = {
  "Готов к выдаче": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Выдан: "bg-green-600/10 text-green-700 dark:text-green-500",
  "Передан в ТК": "bg-blue-600/10 text-blue-700 dark:text-blue-400",
};

function HandoverCard({ order, kind, onClose }: { order: HandoverRow; kind: HandoverKind; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tk = kind === "Передан в ТК";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    body.set("orderId", order.id);
    body.set("kind", kind);
    setError(null);
    startTransition(async () => {
      const r = await handOver(body);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">
        {kind}: заказ {order.orderNumber}
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        {order.customer} · {order.ready.length} поз. на {formatRub(order.readySum)} · {order.payment}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm text-foreground/60">{tk ? "ТК и номер накладной" : "Кому выдан"}</label>
          <input name="note" required={tk} placeholder={tk ? "Деловые линии, № ..." : "ФИО, доверенность"} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-foreground/60">{tk ? "Транспортная накладная (ТН)" : "Подписанный документ (необязательно)"}</label>
          <input name="file" type="file" className="mt-2 block w-full text-sm" />
        </div>
        <p className="text-xs text-foreground/50">
          Оплаченные позиции станут «Завершено», на отсрочке — «Отгружено, требуется оплата». Клиенту уйдёт письмо о смене статуса.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
            Отмена
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "Сохраняем..." : kind}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function HandoverTable({ orders }: { orders: HandoverRow[] }) {
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<{ order: HandoverRow; kind: HandoverKind } | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .map((o) => ({ ...o, state: o.ready.length ? "Готов к выдаче" : (o.handover ?? "—") }))
      .filter((o) => !q || [o.orderNumber, o.customer, o.phone, o.delivery, o.state, o.handoverNote].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => Number(!a.ready.length) - Number(!b.ready.length));
  }, [orders, search]);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Выдача</h1>
        <span className="text-sm text-foreground/50">готово к выдаче: {orders.filter((o) => o.ready.length).length}</span>
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Заказов, готовых к выдаче, нет.</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">Заказ</th>
                <th className="py-2 pr-4">Клиент</th>
                <th className="py-2 pr-4">Позиции</th>
                <th className="py-2 pr-4 text-right">Сумма</th>
                <th className="py-2 pr-4">Оплата</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">ТН</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-foreground/10 align-top">
                  <td className="whitespace-nowrap py-2 pr-4">{o.orderNumber}</td>
                  <td className="py-2 pr-4">
                    <div>{o.customer}</div>
                    <div className="text-xs text-foreground/50">{[o.phone, o.delivery].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="py-2 pr-4">
                    {o.ready.map((i, n) => (
                      <div key={n} className="text-xs">
                        {i.name} × {i.quantity}
                      </div>
                    ))}
                    {o.ready.length > 0 && o.ready.length < o.linesTotal && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        готово {o.ready.length} из {o.linesTotal}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{o.ready.length ? formatRub(o.readySum) : ""}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{o.ready.length ? o.payment : ""}</td>
                  <td className="py-2 pr-4">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[o.state] ?? ""}`}>{o.state}</span>
                    {o.handoverAt && (
                      <div className="mt-1 text-xs text-foreground/50">
                        {o.handover} {new Date(o.handoverAt).toLocaleDateString("ru-RU")}
                        {o.handoverNote && ` · ${o.handoverNote}`}
                      </div>
                    )}
                  </td>
                  <td className="max-w-40 py-2 pr-4">
                    {o.waybills.map((w) => (
                      <a key={w.id} href={w.fileUrl} download={w.fileName} className="block truncate text-blue-600 hover:underline dark:text-blue-400">
                        {w.fileName}
                      </a>
                    ))}
                  </td>
                  <td className="whitespace-nowrap py-2">
                    {o.ready.length > 0 &&
                      HANDOVER_KINDS.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setActing({ order: o, kind })}
                          className="ml-2 rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                        >
                          {kind}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {acting && <HandoverCard order={acting.order} kind={acting.kind} onClose={() => setActing(null)} />}
    </>
  );
}
