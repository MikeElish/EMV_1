"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { createReceipt, getReceivableLines, receiptVatRate } from "@/actions/admin/receipts";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { VAT_RATES } from "@/lib/validators/receipts";
import { useRememberedState } from "@/components/admin/AdminPlaces";

export type ReceiptRow = {
  id: string;
  createdAt: string;
  supplier: string;
  inn: string | null;
  doc: string;
  oneCNumber: string | null;
  warehouse: string;
  amount: number;
  lines: number;
  purchases: number[];
  orders: string[];
  fileName: string | null;
  fileUrl: string | null;
};

type Receivable = Awaited<ReturnType<typeof getReceivableLines>>[number];

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const cellInput = "w-24 rounded border border-foreground/20 bg-transparent px-1.5 py-1 text-right text-sm outline-none focus:border-foreground/50";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const rub = (kopecks: number) => String(kopecks / 100).replace(".", ",");
const parseRub = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? rublesToKopecksRoundedUp(n) : NaN;
};

function ReceiptCard({ warehouses, onClose, onDone }: { warehouses: { ref: string; name: string }[]; onClose: () => void; onDone: (message: string) => void }) {
  const [lines, setLines] = useState<Receivable[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseRef, setWarehouseRef] = useState(warehouses[0]?.ref ?? "");
  const [vatRate, setVatRate] = useState("НДС22");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getReceivableLines().then((l) => !cancelled && setLines(l));
    return () => {
      cancelled = true;
    };
  }, []);

  const suppliers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; inn: string | null; count: number }>();
    for (const l of lines ?? []) {
      const s = map.get(l.supplierId) ?? { id: l.supplierId, name: l.supplierName, inn: l.supplierInn, count: 0 };
      s.count++;
      map.set(l.supplierId, s);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [lines]);
  const shown = (lines ?? []).filter((l) => l.supplierId === supplierId);

  function pickSupplier(id: string) {
    setSupplierId(id);
    const own = (lines ?? []).filter((l) => l.supplierId === id);
    // Paid ones are what is expected first.
    setChecked(new Set(own.filter((l) => l.status === "ORDERED").map((l) => l.id)));
    setPrices(Object.fromEntries(own.map((l) => [l.id, rub(l.price)])));
    if (id) receiptVatRate(id).then((r) => r && setVatRate(r));
  }

  const total = shown.filter((l) => checked.has(l.id)).reduce((s, l) => s + (parseRub(prices[l.id] ?? "") || 0) * l.quantity, 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const picked = shown.filter((l) => checked.has(l.id));
    const bad = picked.find((l) => Number.isNaN(parseRub(prices[l.id] ?? "")));
    if (bad) return setError(`Проверьте цену: ${bad.product}`);
    const body = new FormData();
    body.set(
      "data",
      JSON.stringify({
        supplierId,
        warehouseRef,
        vatRate,
        docNumber: String(form.get("docNumber") ?? ""),
        docDate: String(form.get("docDate") ?? ""),
        note: String(form.get("note") ?? ""),
        lines: picked.map((l) => ({ lineId: l.id, price: parseRub(prices[l.id]) })),
      })
    );
    const file = form.get("file");
    if (file instanceof File && file.size) body.set("file", file);
    setError(null);
    startTransition(async () => {
      const r = await createReceipt(body);
      if (!r.ok) setError(r.error);
      else onDone(r.message);
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-5xl">
      <h2 className="text-lg font-semibold">Поступление</h2>
      {!lines ? (
        <p className="mt-4 text-sm text-foreground/50">Загрузка...</p>
      ) : !suppliers.length ? (
        <p className="mt-4 text-sm text-foreground/50">Нет позиций, ожидающих поставки: в «Заказ поставщику» нет строк «Заказать», «Требуется оплата» или «Заказано».</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-foreground/60">Поставщик *</label>
              <SearchSelect
                value={supplierId}
                onChange={pickSupplier}
                emptyLabel="— выберите —"
                options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: [s.inn && `ИНН ${s.inn}`, `${s.count} поз.`].filter(Boolean).join(" · ") }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-foreground/60">Склад *</label>
              <select value={warehouseRef} onChange={(e) => setWarehouseRef(e.target.value)} className={inputClass}>
                {warehouses.map((w) => (
                  <option key={w.ref} value={w.ref}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-sm text-foreground/60">УПД № *</label>
              <input name="docNumber" required className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-foreground/60">Дата УПД *</label>
              <input name="docDate" type="date" required defaultValue={today()} className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-foreground/60">НДС</label>
              <select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputClass}>
                {Object.entries(VAT_RATES).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground/60">Файл УПД</label>
              <input name="file" type="file" className="mt-2 block w-full text-sm" />
            </div>
          </div>

          {supplierId && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/50">
                  <th className="w-6 py-1" />
                  <th className="py-1 pr-2">Товар</th>
                  <th className="py-1 pr-2">Заказ поставщику / клиента</th>
                  <th className="py-1 pr-2">Статус</th>
                  <th className="py-1 pr-2 text-right">Кол-во</th>
                  <th className="py-1 pr-2 text-right">Цена по УПД, ₽</th>
                  <th className="py-1 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const on = checked.has(l.id);
                  return (
                    <tr key={l.id} className={`border-b border-foreground/10 ${on ? "" : "text-foreground/40"}`}>
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setChecked((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(l.id);
                              else next.delete(l.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <div>{l.product}</div>
                        <div className="text-xs text-foreground/50">{l.sku}</div>
                      </td>
                      <td className="whitespace-nowrap py-1 pr-2">
                        {l.purchaseNumber ? `№ ${l.purchaseNumber}` : "—"} / {l.orderNumber ?? "на склад"}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-2">{SUPPLIER_ORDER_STATUS_LABELS[l.status]}</td>
                      <td className="py-1 pr-2 text-right">{l.quantity}</td>
                      <td className="py-1 pr-2 text-right">
                        <input value={prices[l.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))} inputMode="decimal" className={cellInput} />
                      </td>
                      <td className="whitespace-nowrap py-1 text-right">{formatRub((parseRub(prices[l.id] ?? "") || 0) * l.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <label className="text-sm text-foreground/60">Комментарий</label>
              <input name="note" className={inputClass} />
            </div>
            <p className="pb-2 text-sm">
              Итого по УПД: <span className="font-medium">{formatRub(total)}</span>
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
              Отмена
            </button>
            <button
              type="submit"
              disabled={pending || !supplierId || !checked.size}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {pending ? "Проводим в 1С..." : "Провести в 1С"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ReceiptsTable({ receipts, warehouses }: { receipts: ReceiptRow[]; warehouses: { ref: string; name: string }[] }) {
  const [search, setSearch] = useRememberedState("search", "");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => [r.supplier, r.inn, r.doc, r.oneCNumber, r.warehouse, ...r.orders, ...r.purchases].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [receipts, search]);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          aria-label="Новое поступление"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </button>
        <h1 className="text-lg font-semibold">Поступление</h1>
        {message && <span className="text-sm text-green-700 dark:text-green-500">{message}</span>}
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">{receipts.length ? "Ничего не найдено." : "Поступлений с сайта пока нет — оформите УПД поставщика зелёным «+»."}</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Поставщик</th>
                <th className="py-2 pr-4">УПД</th>
                <th className="py-2 pr-4">1С</th>
                <th className="py-2 pr-4">Склад</th>
                <th className="py-2 pr-4">Заказы</th>
                <th className="py-2 pr-4 text-right">Сумма</th>
                <th className="py-2">Файл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-foreground/10 align-top">
                  <td className="whitespace-nowrap py-2 pr-4">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td className="py-2 pr-4">
                    <div>{r.supplier}</div>
                    {r.inn && <div className="text-xs text-foreground/50">ИНН {r.inn}</div>}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{r.doc}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{r.oneCNumber ? `Поступление ${r.oneCNumber}` : "—"}</td>
                  <td className="py-2 pr-4">{r.warehouse}</td>
                  <td className="py-2 pr-4">
                    <div>{r.orders.join(", ") || "—"}</div>
                    {r.purchases.length > 0 && <div className="text-xs text-foreground/50">поставщику № {r.purchases.join(", ")}</div>}
                    <div className="text-xs text-foreground/50">{r.lines} поз.</div>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{formatRub(r.amount)}</td>
                  <td className="max-w-40 truncate py-2">
                    {r.fileUrl ? (
                      <a href={r.fileUrl} download={r.fileName ?? undefined} className="text-blue-600 hover:underline dark:text-blue-400">
                        {r.fileName}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {open && (
        <ReceiptCard
          warehouses={warehouses}
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            setMessage(m);
          }}
        />
      )}
    </>
  );
}
