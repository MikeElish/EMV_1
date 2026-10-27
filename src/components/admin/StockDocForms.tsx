"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAdjustmentDoc,
  createTransferDoc,
  searchOneCItems,
  type DocsResult,
  type ItemHit,
} from "@/actions/admin/warehouse";
import { Modal } from "@/components/Modal";

export type StockItem = { ref: string; name: string; sku: string; qty?: number };
type Line = StockItem & { qtyText: string; priceText: string };
type Warehouse = { ref: string; name: string };

const inputClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const num = (s: string) => Number(s.replace(",", ".").replace(/\s/g, ""));
const qtyText = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** Finds an item: in the given list (a warehouse's stock), or among all 1С goods. */
export function ItemPicker({ from, onPick }: { from?: StockItem[]; onPick: (item: StockItem & { price?: number | null }) => void }) {
  const [query, setQuery] = useState("");
  // Answer of 1С search, with the query it belongs to.
  const [remote, setRemote] = useState<{ query: string; hits: ItemHit[] }>({ query: "", hits: [] });

  const local = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!from || !words.length) return [];
    return from.filter((i) => words.every((w) => `${i.sku} ${i.name}`.toLowerCase().includes(w))).slice(0, 30);
  }, [query, from]);

  useEffect(() => {
    if (from || !query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchOneCItems(query);
      if (!cancelled) setRemote({ query, hits: found });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, from]);

  const searching = !from && remote.query !== query;
  const hits: (StockItem & { price?: number | null })[] = from ? local : remote.hits;

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={from ? "Найти товар на складе: артикул или название" : "Найти товар в 1С: артикул или название"}
        className={inputClass}
      />
      {query.trim() && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-foreground/20 bg-background shadow-lg">
          {searching && <li className="px-3 py-2 text-sm text-foreground/50">Ищем…</li>}
          {!searching && hits.length === 0 && <li className="px-3 py-2 text-sm text-foreground/50">Ничего не найдено</li>}
          {hits.map((h) => (
            <li key={h.ref}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setQuery("");
                }}
                className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm hover:bg-foreground/5"
              >
                <span className="shrink-0 font-mono text-xs text-foreground/60">{h.sku || "—"}</span>
                <span className="flex-1">{h.name}</span>
                {h.qty !== undefined && <span className="shrink-0 text-foreground/50">{qtyText(h.qty)} шт</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinesEditor({
  lines,
  setLines,
  withPrice,
  from,
}: {
  lines: Line[];
  setLines: (fn: (prev: Line[]) => Line[]) => void;
  withPrice: boolean;
  from?: StockItem[];
}) {
  return (
    <div className="space-y-3">
      <ItemPicker
        from={from}
        onPick={(item) =>
          setLines((prev) =>
            prev.some((l) => l.ref === item.ref)
              ? prev
              : [...prev, { ...item, qtyText: "1", priceText: item.price ? String(item.price) : "" }]
          )
        }
      />
      {lines.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-foreground/50">
              <th className="py-1 pr-2">Товар</th>
              {from && <th className="py-1 pr-2 text-right">На складе</th>}
              <th className="w-24 py-1 pr-2">Кол-во</th>
              {withPrice && <th className="w-28 py-1 pr-2">Цена, ₽</th>}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.ref} className="border-t border-foreground/10">
                <td className="py-1 pr-2">
                  <span className="font-mono text-xs text-foreground/60">{l.sku || "—"}</span> {l.name}
                </td>
                {from && <td className="py-1 pr-2 text-right text-foreground/60">{qtyText(l.qty ?? 0)}</td>}
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Количество: ${l.name}`}
                    inputMode="decimal"
                    value={l.qtyText}
                    onChange={(e) => setLines((prev) => prev.map((x) => (x.ref === l.ref ? { ...x, qtyText: e.target.value } : x)))}
                    className="w-full rounded border border-foreground/20 bg-transparent px-2 py-1"
                  />
                </td>
                {withPrice && (
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Цена: ${l.name}`}
                      inputMode="decimal"
                      value={l.priceText}
                      onChange={(e) => setLines((prev) => prev.map((x) => (x.ref === l.ref ? { ...x, priceText: e.target.value } : x)))}
                      className="w-full rounded border border-foreground/20 bg-transparent px-2 py-1"
                    />
                  </td>
                )}
                <td className="py-1 text-right">
                  <button
                    type="button"
                    aria-label={`Убрать: ${l.name}`}
                    onClick={() => setLines((prev) => prev.filter((x) => x.ref !== l.ref))}
                    className="text-foreground/50 hover:text-red-600"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** «Документ № … создан и проведён в 1С». */
export function CreatedNote({ result }: { result: DocsResult }) {
  if (!result.ok) return <p className="text-sm text-red-600">{result.error}</p>;
  return (
    <p className="text-sm text-green-600">
      Проведено в 1С: {result.docs.map((d) => `${d.kind} № ${d.number}`).join(", ")}
    </p>
  );
}

/** Runs a document action; on success the page behind the window shows the new stock. */
function useSubmit() {
  const router = useRouter();
  const [result, setResult] = useState<DocsResult | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<DocsResult>) {
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if (r.ok) router.refresh();
    });
  }
  return { result, pending, run };
}

function parseLines(lines: Line[], withPrice: boolean): { itemRef: string; qty: number; price?: number }[] | string {
  if (!lines.length) return "Добавьте хотя бы один товар";
  const out = [];
  for (const l of lines) {
    const qty = num(l.qtyText);
    if (!(qty > 0)) return `Укажите количество: ${l.name}`;
    const price = withPrice ? num(l.priceText) : undefined;
    if (withPrice && !(price! > 0)) return `Укажите цену: ${l.name}`;
    out.push({ itemRef: l.ref, qty, ...(withPrice ? { price } : {}) });
  }
  return out;
}

export function TransferModal({
  warehouse,
  warehouses,
  stock,
  onClose,
}: {
  warehouse: Warehouse;
  warehouses: Warehouse[];
  stock: StockItem[];
  onClose: () => void;
}) {
  const others = warehouses.filter((w) => w.ref !== warehouse.ref);
  const [to, setTo] = useState(others[0]?.ref ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { result, pending, run } = useSubmit();

  function submit() {
    const parsed = parseLines(lines, false);
    if (typeof parsed === "string") return setError(parsed);
    setError(null);
    run(async () => {
      const r = await createTransferDoc(warehouse.ref, to, parsed, comment);
      if (r.ok) setLines([]);
      return r;
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">Перемещение товаров</h2>
      <p className="mt-1 text-xs text-foreground/50">Документ создаётся и проводится в 1С.</p>
      {others.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/60">Есть только один склад — добавьте второй в Настройки → Склады.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm">
              <span className="text-foreground/60">Откуда</span>
              <p className="mt-1 py-2 font-medium">{warehouse.name}</p>
            </div>
            <label className="text-sm text-foreground/60">
              Куда
              <select value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1 bg-background`}>
                {others.map((w) => (
                  <option key={w.ref} value={w.ref}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <LinesEditor lines={lines} setLines={setLines} withPrice={false} from={stock} />
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий" maxLength={500} className={inputClass} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && <CreatedNote result={result} />}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Проводим в 1С..." : "Провести перемещение"}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function AdjustmentModal({
  warehouses,
  defaultWarehouse,
  onClose,
}: {
  warehouses: Warehouse[];
  defaultWarehouse: string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"writeoff" | "receipt">("writeoff");
  const [warehouse, setWarehouse] = useState(defaultWarehouse);
  const [lines, setLines] = useState<Line[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { result, pending, run } = useSubmit();

  function submit() {
    const parsed = parseLines(lines, kind === "receipt");
    if (typeof parsed === "string") return setError(parsed);
    setError(null);
    run(async () => {
      const r = await createAdjustmentDoc(kind, warehouse, parsed, comment);
      if (r.ok) setLines([]);
      return r;
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">Новый документ</h2>
      <p className="mt-1 text-xs text-foreground/50">Документ создаётся и проводится в 1С.</p>
      <div className="mt-4 space-y-4">
        <div className="flex gap-2">
          {(
            [
              ["writeoff", "Списание"],
              ["receipt", "Оприходование"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                kind === value ? "bg-foreground text-background" : "border border-foreground/20 hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-sm text-foreground/60">
          Склад
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={`${inputClass} mt-1 bg-background`}>
            {warehouses.map((w) => (
              <option key={w.ref} value={w.ref}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <LinesEditor lines={lines} setLines={setLines} withPrice={kind === "receipt"} />
        {kind === "receipt" && (
          <p className="text-xs text-foreground/50">Цена подставляется из закупочной цены товара на сайте — проверьте её.</p>
        )}
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={kind === "writeoff" ? "Причина списания" : "Основание оприходования"}
          maxLength={500}
          className={inputClass}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && <CreatedNote result={result} />}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Проводим в 1С..." : kind === "writeoff" ? "Провести списание" : "Провести оприходование"}
        </button>
      </div>
    </Modal>
  );
}
