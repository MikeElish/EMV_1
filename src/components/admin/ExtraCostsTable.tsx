"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import {
  deleteExtraCost,
  getExtraCostFormData,
  saveExtraCost,
  setExtraCostStatus,
  supplierByInn,
  type ExtraCostFormData,
} from "@/actions/admin/extra-costs";
import { EXTRA_COST_KINDS, EXTRA_COST_STATUSES, type ExtraCostInput } from "@/lib/validators/extra-costs";

export type ExtraCostListRow = {
  id: string;
  kind: string;
  number: string;
  date: string;
  orderId: string | null;
  orderNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  inn: string | null;
  kpp: string | null;
  amount: number;
  status: string;
  note: string | null;
  fileName: string | null;
  fileUrl: string | null;
  lines: { kind: "GOODS" | "SERVICE"; productId: string | null; serviceId: string | null; name: string; quantity: number; price: number }[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const cellInput = "w-full rounded border border-foreground/20 bg-transparent px-1.5 py-1 text-sm outline-none focus:border-foreground/50";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const rub = (kopecks: number) => (kopecks ? String(kopecks / 100).replace(".", ",") : "");
const parseRub = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? rublesToKopecksRoundedUp(n) : NaN;
};

const STATUS_STYLES: Record<string, string> = {
  "Требуется оплата": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Оплачено: "bg-green-600/10 text-green-700 dark:text-green-500",
  Отменено: "bg-foreground/10 text-foreground/50",
};

type Line = { key: number; kind: "GOODS" | "SERVICE"; ref: string; name: string; qty: string; price: string };
let nextKey = 1;

function CostCard({ cost, onClose }: { cost: ExtraCostListRow | null; onClose: () => void }) {
  const [data, setData] = useState<ExtraCostFormData | null>(null);
  const [kind, setKind] = useState(cost?.kind ?? EXTRA_COST_KINDS[0]);
  const [supplierId, setSupplierId] = useState(cost?.supplierId ?? "");
  const [orderId, setOrderId] = useState(cost?.orderId ?? "");
  const [inn, setInn] = useState("");
  const [innNote, setInnNote] = useState<string | null>(null);
  const [tab, setTab] = useState<"GOODS" | "SERVICE">("GOODS");
  const [lines, setLines] = useState<Line[]>(
    (cost?.lines ?? []).map((l) => ({
      key: nextKey++,
      kind: l.kind,
      ref: (l.kind === "GOODS" ? l.productId : l.serviceId) ?? "",
      name: l.name,
      qty: String(l.quantity).replace(".", ","),
      price: rub(l.price),
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getExtraCostFormData().then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const companies = useMemo(() => data?.companies ?? [], [data]);
  const supplier = companies.find((c) => c.id === supplierId);
  const shown = lines.filter((l) => l.kind === tab);
  const lineSum = (l: Line) => {
    const q = parseFloat(l.qty.replace(",", "."));
    const p = parseRub(l.price);
    return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p) : 0;
  };
  const total = lines.reduce((s, l) => s + lineSum(l), 0);

  function update(key: number, patch: Partial<Line>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pick(key: number, ref: string) {
    if (tab === "GOODS") {
      const p = data?.products.find((x) => x.id === ref);
      update(key, { ref, name: p ? [p.brand, p.name, p.sku].filter(Boolean).join(" ") : "" });
    } else {
      const s = data?.services.find((x) => x.id === ref);
      update(key, { ref, name: s?.name ?? "", price: s && s.price > 0 ? rub(s.price) : undefined });
    }
  }

  function findByInn() {
    setInnNote(null);
    startTransition(async () => {
      const r = await supplierByInn(inn);
      if (!r.ok) return setInnNote(r.error);
      setData((d) => (d && !d.companies.some((c) => c.id === r.company.id) ? { ...d, companies: [...d.companies, r.company] } : d));
      setSupplierId(r.company.id);
      setInnNote(r.created ? `Добавлена компания «${r.company.name}» (из ЕГРЮЛ)` : `Найдена «${r.company.name}»`);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bad = lines.find((l) => l.name.trim() && (!(parseFloat(l.qty.replace(",", ".")) > 0) || Number.isNaN(parseRub(l.price))));
    if (bad) return setError(`Проверьте количество и цену: «${bad.name}»`);
    const input: ExtraCostInput = {
      id: cost?.id ?? null,
      kind,
      number: String(form.get("number") ?? ""),
      date: String(form.get("date") ?? ""),
      orderId: orderId || null,
      supplierId: supplierId || null,
      status: String(form.get("status") ?? EXTRA_COST_STATUSES[0]),
      note: String(form.get("note") ?? ""),
      amount: parseRub(String(form.get("amount") ?? "")) || 0,
      lines: lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          kind: l.kind,
          productId: l.kind === "GOODS" ? l.ref || null : null,
          serviceId: l.kind === "SERVICE" ? l.ref || null : null,
          name: l.name,
          quantity: parseFloat(l.qty.replace(",", ".")),
          price: parseRub(l.price),
        })),
    };
    const body = new FormData();
    body.set("data", JSON.stringify(input));
    const file = form.get("file");
    if (file instanceof File && file.size) body.set("file", file);
    setError(null);
    startTransition(async () => {
      const r = await saveExtraCost(body);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl">
      <h2 className="text-lg font-semibold">{cost ? "Расход" : "Новый расход"}</h2>
      {!data ? (
        <p className="mt-4 text-sm text-foreground/50">Загрузка...</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-sm text-foreground/60">Вид расходов *</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                {EXTRA_COST_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground/60">№ документа</label>
              <input name="number" defaultValue={cost?.number} placeholder="Счёт, акт" className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-foreground/60">Дата *</label>
              <input name="date" type="date" required defaultValue={cost?.date ?? today()} className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-foreground/60">Статус</label>
              <select name="status" defaultValue={cost?.status ?? EXTRA_COST_STATUSES[0]} className={inputClass}>
                {EXTRA_COST_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-foreground/60">Контрагент</label>
              <SearchSelect
                value={supplierId}
                onChange={setSupplierId}
                emptyLabel="— не выбран —"
                options={companies.map((c) => ({ value: c.id, label: c.name, hint: [c.inn && `ИНН ${c.inn}`, c.kpp && `КПП ${c.kpp}`].filter(Boolean).join(" ") }))}
                className="mt-1"
              />
              <div className="mt-2 flex gap-2">
                <input
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      findByInn();
                    }
                  }}
                  placeholder="или ИНН"
                  inputMode="numeric"
                  className="w-40 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
                />
                <button
                  type="button"
                  onClick={findByInn}
                  disabled={pending || !inn.trim()}
                  className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
                >
                  Найти по ИНН
                </button>
              </div>
              {innNote && <p className="mt-1 text-xs text-foreground/60">{innNote}</p>}
              {supplier && (supplier.inn || supplier.kpp) && (
                <p className="mt-1 text-xs text-foreground/50">{[supplier.inn && `ИНН ${supplier.inn}`, supplier.kpp && `КПП ${supplier.kpp}`].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">Заказ</label>
              <SearchSelect
                value={orderId}
                onChange={setOrderId}
                emptyLabel="— без заказа —"
                options={data.orders.map((o) => ({ value: o.id, label: o.orderNumber, hint: o.customerName }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 border-b border-foreground/10">
              {(["GOODS", "SERVICE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${tab === t ? "border-foreground font-medium" : "border-transparent text-foreground/50"}`}
                >
                  {t === "GOODS" ? "Товары" : "Услуги"} ({lines.filter((l) => l.kind === t).length})
                </button>
              ))}
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/50">
                  <th className="py-1 pr-2">{tab === "GOODS" ? "Товар" : "Услуга"}</th>
                  <th className="w-20 py-1 pr-2">Кол-во</th>
                  <th className="w-28 py-1 pr-2">Цена, ₽</th>
                  <th className="w-28 py-1 pr-2 text-right">Сумма</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.key} className="align-top">
                    <td className="py-1 pr-2">
                      <SearchSelect
                        value={l.ref}
                        onChange={(ref) => pick(l.key, ref)}
                        options={
                          tab === "GOODS"
                            ? data.products.map((p) => ({ value: p.id, label: p.name, hint: [p.brand, p.sku].filter(Boolean).join(" ") }))
                            : data.services.map((s) => ({ value: s.id, label: s.name, hint: s.unit ?? undefined }))
                        }
                      />
                      <input value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Наименование" className={`${cellInput} mt-1`} />
                    </td>
                    <td className="py-1 pr-2">
                      <input value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} inputMode="decimal" className={cellInput} />
                    </td>
                    <td className="py-1 pr-2">
                      <input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" className={cellInput} />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 text-right">{formatRub(lineSum(l))}</td>
                    <td className="py-2">
                      <button type="button" aria-label="Убрать строку" onClick={() => setLines((all) => all.filter((x) => x.key !== l.key))} className="text-red-600">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => setLines((all) => [...all, { key: nextKey++, kind: tab, ref: "", name: "", qty: "1", price: "" }])}
              className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + Добавить {tab === "GOODS" ? "товар" : "услугу"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-sm text-foreground/60">Сумма{lines.length ? " (по строкам)" : " *"}</label>
              {lines.length ? (
                <p className="mt-2 font-medium">{formatRub(total)}</p>
              ) : (
                <input name="amount" defaultValue={rub(cost?.amount ?? 0)} inputMode="decimal" placeholder="0,00" className={inputClass} />
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">Файл (счёт, акт, билет)</label>
              <input name="file" type="file" className="mt-2 block w-full text-sm" />
              {cost?.fileUrl && (
                <a href={cost.fileUrl} download={cost.fileName ?? undefined} className="mt-1 block truncate text-xs text-blue-600 hover:underline dark:text-blue-400">
                  {cost.fileName}
                </a>
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">Комментарий</label>
              <input name="note" defaultValue={cost?.note ?? ""} className={inputClass} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
              Отмена
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {pending ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function StatusSelect({ cost }: { cost: ExtraCostListRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={cost.status}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => void (await setExtraCostStatus(cost.id, next)));
      }}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none ${STATUS_STYLES[cost.status] ?? ""}`}
    >
      {EXTRA_COST_STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

export function ExtraCostsTable({ costs, initialNumber }: { costs: ExtraCostListRow[]; initialNumber?: string }) {
  const [search, setSearch] = useState(initialNumber ?? "");
  const [editing, setEditing] = useState<ExtraCostListRow | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return costs;
    return costs.filter((c) =>
      [c.kind, c.number, c.orderNumber, c.supplierName, c.inn, c.status, c.note].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [costs, search]);
  const total = filtered.reduce((s, c) => s + (c.status === "Отменено" ? 0 : c.amount), 0);

  return (
    <>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing("new")}
          aria-label="Новый расход"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </button>
        <h1 className="text-lg font-semibold">Доп.расходы</h1>
        <span className="text-sm text-foreground/50">итого {formatRub(total)}</span>
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>

      {costs.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Расходов пока нет — добавьте зелёным «+».</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">Вид расходов</th>
                <th className="py-2 pr-4">Заказ</th>
                <th className="py-2 pr-4">Поставщик</th>
                <th className="py-2 pr-4">ИНН</th>
                <th className="py-2 pr-4">КПП</th>
                <th className="py-2 pr-4 text-right">Сумма</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Файл</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setEditing(c)} className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5">
                  <td className="py-2 pr-4">
                    <div>{c.kind}</div>
                    <div className="text-xs text-foreground/50">
                      {c.number && `№ ${c.number} · `}
                      {new Date(c.date).toLocaleDateString("ru-RU")}
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{c.orderNumber ?? "—"}</td>
                  <td className="py-2 pr-4">{c.supplierName ?? "—"}</td>
                  <td className="py-2 pr-4">{c.inn ?? ""}</td>
                  <td className="py-2 pr-4">{c.kpp ?? ""}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{formatRub(c.amount)}</td>
                  <td className="py-2 pr-4">
                    <StatusSelect cost={c} />
                  </td>
                  <td className="max-w-40 truncate py-2 pr-4">
                    {c.fileUrl ? (
                      <a href={c.fileUrl} download={c.fileName ?? undefined} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline dark:text-blue-400">
                        {c.fileName}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                    <DeleteButton action={() => deleteExtraCost(c.id)} confirmText="Удалить расход?" className="text-red-600 hover:underline disabled:opacity-50" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {editing && <CostCard cost={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
