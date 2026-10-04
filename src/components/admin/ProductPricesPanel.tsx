"use client";

import { FitWidth } from "@/components/FitWidth";
import { applyMarkup, markupOf, type Markups } from "@/lib/pricing";
import { rublesToKopecksRoundedUp } from "@/lib/money";

export type SaleKind = "retail" | "wholesale" | "dealer";
export type PriceField = { pct: string; rub: string };
export type PricesState = {
  supplierId: string;
  purchaseRub: string;
  sale: Record<SaleKind, PriceField>;
  // First supplier offer (new product / no offers yet).
  deliveryDays: string;
  quality: string;
  // Card with offers: the one the site prices follow.
  selectedOfferId: string;
};

/** A supplier offer as shown in the card (view only). */
export type OfferRow = {
  id: string;
  supplierName: string | null;
  price: number;
  deliveryDays: number | null;
  quality: string | null;
  selected: boolean;
  updatedAt: Date;
};

export const QUALITY_SUGGESTIONS = ["Оригинал", "Аналог (OEM)", "Аналог", "Б/у"];

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
  existing?: { supplierId: string | null; purchase: number; retail: number; wholesale: number; dealer: number },
  offers: OfferRow[] = [],
): PricesState {
  const firstOffer = {
    deliveryDays: "",
    quality: "",
    selectedOfferId: (offers.find((o) => o.selected) ?? offers[0])?.id ?? "",
  };
  if (!existing) {
    const empty = (kind: SaleKind): PriceField => ({ pct: pctToString(markups[MARKUP_KEY[kind]]), rub: "" });
    return {
      supplierId: "",
      purchaseRub: "",
      sale: { retail: empty("retail"), wholesale: empty("wholesale"), dealer: empty("dealer") },
      ...firstOffer,
    };
  }
  const field = (price: number): PriceField => ({
    pct: pctToString(markupOf(existing.purchase, price)),
    rub: kopecksToRub(price),
  });
  return {
    supplierId: existing.supplierId ?? "",
    purchaseRub: kopecksToRub(existing.purchase),
    sale: { retail: field(existing.retail), wholesale: field(existing.wholesale), dealer: field(existing.dealer) },
    ...firstOffer,
  };
}

const formatPrice = (kopecks: number) =>
  (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
const formatDay = (d: Date) => new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
const formatDays = (n: number | null) => (n === null ? "—" : `${n} дн.`);

/**
 * Supplier offers of the product, view only. With more than one, the box on
 * the left picks the one whose price the site prices follow. New offers come
 * from «Проценка».
 */
function OffersTable({
  offers,
  selectedId,
  onSelect,
}: {
  offers: OfferRow[];
  selectedId: string;
  onSelect: (offer: OfferRow) => void;
}) {
  const choosable = offers.length > 1;
  return (
    <div>
      <p className="text-sm text-foreground/60">Предложения поставщиков</p>
      <FitWidth className="mt-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              {choosable && <th className="w-8 py-2" />}
              <th className="py-2 pr-3 font-normal">Поставщик</th>
              <th className="py-2 pr-3 font-normal">Цена</th>
              <th className="py-2 pr-3 font-normal">Срок поставки</th>
              <th className="py-2 pr-3 font-normal">Качество</th>
              <th className="py-2 font-normal">Актуальность</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const selected = o.id === selectedId;
              return (
                <tr
                  key={o.id}
                  className={`border-b border-foreground/10 ${selected && choosable ? "bg-green-600/5" : ""}`}
                >
                  {choosable && (
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onSelect(o)}
                        aria-label={`Цена на сайте от ${o.supplierName ?? "поставщика"}`}
                        title="Эта цена будет указана на сайте"
                      />
                    </td>
                  )}
                  <td className="py-2 pr-3">{o.supplierName ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-3 font-medium">{formatPrice(o.price)}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{formatDays(o.deliveryDays)}</td>
                  <td className="py-2 pr-3">{o.quality ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 text-foreground/60">{formatDay(o.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </FitWidth>
      <p className="mt-1 text-xs text-foreground/50">
        {choosable
          ? "Отмеченная цена закупки — основа цен на сайте. Изменение применится после «Сохранить»."
          : "Новые предложения добавляются через «Проценку»."}
      </p>
    </div>
  );
}

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function ProductPricesPanel({
  value,
  onChange,
  suppliers,
  offers = [],
}: {
  value: PricesState;
  onChange: (next: PricesState) => void;
  suppliers: { id: string; name: string; inn: string | null }[];
  /** Supplier offers of an existing card; empty for a new product. */
  offers?: OfferRow[];
}) {
  const purchase = toKopecks(value.purchaseRub);

  function setPurchase(purchaseRub: string) {
    onChange(setPurchaseState(purchaseRub));
  }

  function selectOffer(offer: OfferRow) {
    onChange({ ...setPurchaseState(kopecksToRub(offer.price)), selectedOfferId: offer.id });
  }

  function setPurchaseState(purchaseRub: string): PricesState {
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
    return { ...value, purchaseRub, sale };
  }

  function setPct(kind: SaleKind, pctText: string) {
    const pct = parseFloat(pctText.replace(",", "."));
    const rub =
      purchase !== null && Number.isFinite(pct) ? kopecksToRub(applyMarkup(purchase, pct)) : value.sale[kind].rub;
    onChange({ ...value, sale: { ...value.sale, [kind]: { pct: pctText, rub } } });
  }

  function setRub(kind: SaleKind, rubText: string) {
    const price = toKopecks(rubText);
    const pct =
      purchase !== null && purchase > 0 && price !== null
        ? pctToString(markupOf(purchase, price))
        : value.sale[kind].pct;
    onChange({ ...value, sale: { ...value.sale, [kind]: { pct, rub: rubText } } });
  }

  return (
    <div className="space-y-4">
      {offers.length > 0 ? (
        <OffersTable offers={offers} selectedId={value.selectedOfferId} onSelect={selectOffer} />
      ) : (
        <>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deliveryDays" className="text-sm text-foreground/60">
                Срок поставки, дн.
              </label>
              <input
                id="deliveryDays"
                inputMode="numeric"
                value={value.deliveryDays}
                onChange={(e) => onChange({ ...value, deliveryDays: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className={`mt-1 ${inputClassName}`}
              />
            </div>
            <div>
              <label htmlFor="quality" className="text-sm text-foreground/60">
                Качество
              </label>
              <input
                id="quality"
                list="quality-suggestions"
                value={value.quality}
                onChange={(e) => onChange({ ...value, quality: e.target.value })}
                className={`mt-1 ${inputClassName}`}
              />
              <datalist id="quality-suggestions">
                {QUALITY_SUGGESTIONS.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>
            </div>
          </div>
        </>
      )}

      <FitWidth>
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
      </FitWidth>
    </div>
  );
}
