"use client";

import { applyMarkup, markupOf, type Markups } from "@/lib/pricing";
import { rublesToKopecksRoundedUp } from "@/lib/money";

export type SaleKind = "retail" | "wholesale" | "dealer";
export type PriceField = { pct: string; rub: string };
export type PricesState = {
  supplierId: string;
  purchaseRub: string;
  sale: Record<SaleKind, PriceField>;
};

export const SALE_KINDS: { kind: SaleKind; label: string; hint?: string }[] = [
  { kind: "retail", label: "Розничная" },
  { kind: "wholesale", label: "Оптовая", hint: "показывается на сайте" },
  { kind: "dealer", label: "Дилерская" },
];

const MARKUP_KEY: Record<SaleKind, keyof Markups> = {
  retail: "retailMarkup",
  wholesale: "wholesaleMarkup",
  dealer: "dealerMarkup",
};

export function toKopecks(rub: string): number | null {
  const value = parseFloat(rub.replace(",", "."));
  return Number.isFinite(value) ? rublesToKopecksRoundedUp(value) : null;
}

function kopecksToRub(kopecks: number): string {
  return (kopecks / 100).toFixed(2).replace(/\.00$/, "");
}

function pctToString(pct: number): string {
  return String(Math.round(pct * 100) / 100);
}

export function initialPrices(
  markups: Markups,
  existing?: { supplierId: string | null; purchase: number; retail: number; wholesale: number; dealer: number }
): PricesState {
  if (!existing) {
    const empty = (kind: SaleKind): PriceField => ({ pct: pctToString(markups[MARKUP_KEY[kind]]), rub: "" });
    return { supplierId: "", purchaseRub: "", sale: { retail: empty("retail"), wholesale: empty("wholesale"), dealer: empty("dealer") } };
  }
  const field = (price: number): PriceField => ({
    pct: pctToString(markupOf(existing.purchase, price)),
    rub: kopecksToRub(price),
  });
  return {
    supplierId: existing.supplierId ?? "",
    purchaseRub: kopecksToRub(existing.purchase),
    sale: { retail: field(existing.retail), wholesale: field(existing.wholesale), dealer: field(existing.dealer) },
  };
}

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function ProductPricesPanel({
  value,
  onChange,
  suppliers,
}: {
  value: PricesState;
  onChange: (next: PricesState) => void;
  suppliers: { id: string; name: string; inn: string | null }[];
}) {
  const purchase = toKopecks(value.purchaseRub);

  function setPurchase(purchaseRub: string) {
    const nextPurchase = toKopecks(purchaseRub);
    const sale = { ...value.sale };
    // Keep each markup % and move the price with the purchase price.
    for (const { kind } of SALE_KINDS) {
      const pct = parseFloat(sale[kind].pct.replace(",", "."));
      sale[kind] = {
        pct: sale[kind].pct,
        rub: nextPurchase !== null && Number.isFinite(pct) ? kopecksToRub(applyMarkup(nextPurchase, pct)) : "",
      };
    }
    onChange({ ...value, purchaseRub, sale });
  }

  function setPct(kind: SaleKind, pctText: string) {
    const pct = parseFloat(pctText.replace(",", "."));
    const rub = purchase !== null && Number.isFinite(pct) ? kopecksToRub(applyMarkup(purchase, pct)) : value.sale[kind].rub;
    onChange({ ...value, sale: { ...value.sale, [kind]: { pct: pctText, rub } } });
  }

  function setRub(kind: SaleKind, rubText: string) {
    const price = toKopecks(rubText);
    const pct = purchase !== null && purchase > 0 && price !== null ? pctToString(markupOf(purchase, price)) : value.sale[kind].pct;
    onChange({ ...value, sale: { ...value.sale, [kind]: { pct, rub: rubText } } });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="supplierId" className="text-sm text-foreground/60">
          Поставщик
        </label>
        <select
          id="supplierId"
          value={value.supplierId}
          onChange={(e) => onChange({ ...value, supplierId: e.target.value })}
          className={`mt-1 ${inputClassName}`}
        >
          <option value="">— не выбран —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.inn ? ` (ИНН ${s.inn})` : ""}
            </option>
          ))}
        </select>
        {suppliers.length === 0 && (
          <p className="mt-1 text-xs text-foreground/50">
            Поставщиков пока нет — добавьте компанию с ролью «Поставщик» в CRM → Компании.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="purchaseRub" className="text-sm text-foreground/60">
          Закупочная цена, ₽
        </label>
        <input
          id="purchaseRub"
          inputMode="decimal"
          value={value.purchaseRub}
          onChange={(e) => setPurchase(e.target.value)}
          className={`mt-1 ${inputClassName}`}
        />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-foreground/50">
            <th className="pb-1 pr-3 font-normal">Цена</th>
            <th className="pb-1 pr-3 font-normal">Наценка, %</th>
            <th className="pb-1 font-normal">Цена, ₽</th>
          </tr>
        </thead>
        <tbody>
          {SALE_KINDS.map(({ kind, label, hint }) => (
            <tr key={kind}>
              <td className="py-1 pr-3">
                {label}
                {hint && <div className="text-xs text-foreground/40">{hint}</div>}
              </td>
              <td className="py-1 pr-3">
                <input
                  aria-label={`${label}: наценка, %`}
                  inputMode="decimal"
                  value={value.sale[kind].pct}
                  onChange={(e) => setPct(kind, e.target.value)}
                  className={inputClassName}
                />
              </td>
              <td className="py-1">
                <input
                  aria-label={`${label}: цена, ₽`}
                  inputMode="decimal"
                  value={value.sale[kind].rub}
                  onChange={(e) => setRub(kind, e.target.value)}
                  className={inputClassName}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
