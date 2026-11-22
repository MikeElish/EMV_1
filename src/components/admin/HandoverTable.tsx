"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { formatAdminPrice } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { DocumentFileLink } from "@/components/admin/DocumentFileLink";
import { handOver, issueUpd } from "@/actions/admin/receipts";
import { HANDOVER_KINDS, type HandoverKind } from "@/lib/validators/receipts";
import { useRememberedState } from "@/components/admin/AdminPlaces";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { LogisticsRequestModal, type LogisticsSource } from "@/components/admin/LogisticsRequestModal";

export type HandoverLine = {
  itemId: string;
  productId: string;
  brand: string;
  name: string;
  sku: string;
  quantity: number;
  stock: number;
};

export type HandoverRow = {
  id: string;
  orderId: string;
  canEdit: boolean;
  orderNumber: string;
  customer: string;
  organization: string;
  phone: string;
  delivery: string | null;
  ready: HandoverLine[];
  readySum: number;
  linesTotal: number;
  payment: string;
  handover: string | null;
  handoverAt: string | null;
  handoverNote: string | null;
  documents: { id: string; label: string; fileName: string; fileUrl: string }[];
  updPending: boolean;
  buyerCompanyId: string | null;
};

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";

const STATE_STYLES: Record<string, string> = {
  "Готов к выдаче": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Выдан: "bg-green-600/10 text-green-700 dark:text-green-500",
  "Передан в ТК": "bg-blue-600/10 text-blue-700 dark:text-blue-400",
};

function defaultShipQty(line: HandoverLine): number {
  return Math.min(line.quantity, Math.max(0, line.stock));
}

function QtyModal({
  order,
  values,
  onClose,
  onSave,
}: {
  order: HandoverRow;
  values: Record<string, number>;
  onClose: () => void;
  onSave: (next: Record<string, number>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const line of order.ready) {
      init[line.itemId] = values[line.itemId] ?? defaultShipQty(line);
    }
    return init;
  });

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">Корректировка количества к отгрузке · {order.orderNumber}</h2>
      <div className="mt-4 max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className={STICKY_THEAD}>
            <tr className="text-left text-foreground/50">
              <th className="py-2 pr-3">№</th>
              <th className="py-2 pr-3">Бренд</th>
              <th className="py-2 pr-3">Наименование</th>
              <th className="py-2 pr-3">Артикул</th>
              <th className="py-2 pr-3 text-right">Заказано</th>
              <th className="py-2 pr-3 text-right">В наличии</th>
              <th className="py-2 pr-3 text-right">К отгрузке</th>
            </tr>
          </thead>
          <tbody>
            {order.ready.map((line, idx) => (
              <tr key={line.itemId} className="border-b border-foreground/10">
                <td className="py-2 pr-3">{idx + 1}</td>
                <td className="py-2 pr-3">{line.brand || "—"}</td>
                <td className="py-2 pr-3">{line.name}</td>
                <td className="py-2 pr-3">{line.sku || "—"}</td>
                <td className="py-2 pr-3 text-right">{line.quantity}</td>
                <td className="py-2 pr-3 text-right">{line.stock}</td>
                <td className="py-2 pr-3 text-right">
                  <input
                    type="number"
                    min={0}
                    max={line.quantity}
                    value={draft[line.itemId] ?? 0}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [line.itemId]: Math.min(line.quantity, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-20 rounded border border-foreground/20 bg-transparent px-2 py-1 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
          Отмена
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          Сохранить
        </button>
      </div>
    </Modal>
  );
}

function HandoverCard({
  order,
  kind,
  quantities,
  onClose,
  onDone,
}: {
  order: HandoverRow;
  kind: HandoverKind;
  quantities: Record<string, number>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tk = kind === "Передан в ТК";
  const linesToShip = order.ready.filter((l) => (quantities[l.itemId] ?? defaultShipQty(l)) > 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    body.set("orderId", order.id);
    body.set("kind", kind);
    body.set("documentCategory", tk ? "WAYBILL" : "UPD");
    body.set("quantities", JSON.stringify(quantities));
    setError(null);
    startTransition(async () => {
      const r = await handOver(body);
      if (!r.ok) setError(r.error);
      else onDone(r.message);
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">
        {kind}: заказ {order.orderNumber}
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        {order.customer} · {linesToShip.length} поз. на {formatAdminPrice(order.readySum)} · {order.payment}
      </p>
      <div className="mt-3 max-h-32 overflow-auto rounded border border-foreground/10 bg-foreground/[0.03] p-2 text-xs">
        {linesToShip.map((l) => (
          <div key={l.itemId}>
            {l.name} × {quantities[l.itemId] ?? defaultShipQty(l)}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm text-foreground/60">{tk ? "ТК и номер накладной" : "Кому выдан"}</label>
          <input name="note" required={tk} placeholder={tk ? "Деловые линии, № ..." : "ФИО, доверенность"} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-foreground/60">{tk ? "Транспортная накладная (ТН)" : "УПД"}</label>
          <input name="file" type="file" required className="mt-2 block w-full text-sm" />
        </div>
        <p className="text-xs text-foreground/50">
          Оплаченные позиции станут «Завершено», на отсрочке — «Отгружено, требуется оплата». Клиенту уйдёт письмо о смене статуса.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Отмена
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "Проводим в 1С..." : kind}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function HandoverTable({ orders }: { orders: HandoverRow[] }) {
  const [search, setSearch] = useRememberedState("search", "");
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<{ order: HandoverRow; kind: HandoverKind } | null>(null);
  const [qtyOrder, setQtyOrder] = useState<HandoverRow | null>(null);
  const [shipQty, setShipQty] = useState<Record<string, Record<string, number>>>({});
  const [logisticsSource, setLogisticsSource] = useState<LogisticsSource | null>(null);

  function buildHandoverLogisticsSource(order: HandoverRow): LogisticsSource {
    return {
      kind: "order",
      orderId: order.orderId,
      counterpartyId: order.buyerCompanyId,
      address: order.delivery,
      documentKind: "UPD",
      lines: order.ready.map((r) => ({
        productId: r.productId,
        brand: r.brand,
        name: r.name,
        sku: r.sku,
        quantity: shipQty[order.id]?.[r.itemId] ?? defaultShipQty(r),
        price: 0,
      })),
    };
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .map((o) => ({ ...o, state: o.ready.length ? "Готов к выдаче" : (o.handover ?? "—") }))
      .filter((o) =>
        !q ||
        [o.orderNumber, o.customer, o.organization, o.phone, o.delivery, o.state, o.handoverNote].filter(Boolean).join(" ").toLowerCase().includes(q)
      )
      .sort((a, b) => Number(!a.ready.length && !a.updPending) - Number(!b.ready.length && !b.updPending));
  }, [orders, search]);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Выдача</h1>
        <span className="text-sm text-foreground/50">готово к выдаче: {orders.filter((o) => o.ready.length).length}</span>
        {message && <span className="text-sm text-foreground/80">{message}</span>}
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
                <th className="py-2 pr-4">Организация</th>
                <th className="py-2 pr-4">Позиции</th>
                <th className="py-2 pr-4 text-right">Сумма</th>
                <th className="py-2 pr-4">Оплата</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Документы</th>
                <th className="py-2">Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => o.ready.length > 0 && setQtyOrder(o)}
                  className={`border-b border-foreground/10 align-top ${o.ready.length > 0 ? "cursor-pointer hover:bg-foreground/5" : ""}`}
                >
                  <td className="whitespace-nowrap py-2 pr-4">{o.orderNumber}</td>
                  <td className="py-2 pr-4">
                    <div>{o.customer}</div>
                    <div className="text-xs text-foreground/50">{[o.phone, o.delivery].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="py-2 pr-4">{o.organization || "—"}</td>
                  <td className="py-2 pr-4">
                    {o.ready.map((i, n) => (
                      <div key={n} className="text-xs">
                        {i.name} × {shipQty[o.id]?.[i.itemId] ?? defaultShipQty(i)}
                      </div>
                    ))}
                    {o.ready.length > 0 && o.ready.length < o.linesTotal && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        готово {o.ready.length} из {o.linesTotal}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{o.ready.length ? formatAdminPrice(o.readySum) : ""}</td>
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
                  <td className="max-w-48 py-2 pr-4">
                    {o.documents.map((d) => (
                      <span key={d.id} className="block truncate">
                        {d.label}:{" "}
                        <DocumentFileLink
                          fileUrl={d.fileUrl}
                          fileName={d.fileName}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        />
                      </span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap py-2">
                    <ActionMenu
                      items={[
                        {
                          label: "Логистика",
                          onClick: () => setLogisticsSource(buildHandoverLogisticsSource(o)),
                        },
                        {
                          label: "УПД",
                          disabled: true,
                          onClick: () => {},
                        },
                        ...(o.canEdit && o.updPending
                          ? [
                              {
                                label: "Сформировать УПД",
                                onClick: () => issueUpd(o.id).then((r) => setMessage(r.ok ? r.message : r.error)),
                              },
                            ]
                          : []),
                        ...(o.canEdit && o.ready.length > 0
                          ? HANDOVER_KINDS.map((kind) => ({
                              label: kind,
                              onClick: () => setActing({ order: o, kind }),
                            }))
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {qtyOrder && (
        <QtyModal
          order={qtyOrder}
          values={shipQty[qtyOrder.id] ?? {}}
          onClose={() => setQtyOrder(null)}
          onSave={(next) => {
            setShipQty((prev) => ({ ...prev, [qtyOrder.id]: next }));
            setQtyOrder(null);
          }}
        />
      )}
      {acting && (
        <HandoverCard
          order={acting.order}
          kind={acting.kind}
          quantities={shipQty[acting.order.id] ?? {}}
          onClose={() => setActing(null)}
          onDone={(m) => {
            setActing(null);
            setMessage(m);
          }}
        />
      )}
      {logisticsSource && <LogisticsRequestModal source={logisticsSource} onClose={() => setLogisticsSource(null)} />}
    </>
  );
}
