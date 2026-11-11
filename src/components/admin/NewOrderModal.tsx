"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnchoredDropdown } from "@/components/AnchoredDropdown";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { SuggestField } from "@/components/SuggestField";
import {
  DeliveryMethodSelect,
  DELIVERY_LABELS,
  type DeliveryMethod,
} from "@/components/shop/DeliveryMethodSelect";
import { RU_CITIES } from "@/content/ru-cities";
import { DELLIN_TERMINALS } from "@/content/dellin-terminals";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import {
  getManualOrderFormData,
  createManualOrder,
  createReplenishmentOrder,
  registerPendingProduct,
  type ManualOrderFormData,
  type ManualOrderFormMode,
} from "@/actions/admin/manual-order";
import { PRICE_TYPES, PRICE_TYPE_LABELS, type PriceType } from "@/lib/validators/manual-order";
import { applyMarkup } from "@/lib/pricing";
import { formatSupplierCurrency, parseSupplierCurrency } from "@/lib/supplier-currency";

type Customer = ManualOrderFormData["customers"][number];
type Company = ManualOrderFormData["companies"][number];
// The «Покупатель» search finds people with an account and client companies.
type Buyer = { id: string; customer: Customer; company?: undefined } | { id: string; company: Company; customer?: undefined };
type Product = ManualOrderFormData["products"][number];
type Line = { key: number; productId: string; offerId: string; quantity: string; priceRub: string };
type Tab = "items" | "delivery";

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

const kopecksToRub = (kopecks: number) => (kopecks / 100).toFixed(2).replace(/\.00$/, "");

function parseRub(value: string): number | null {
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? rublesToKopecksRoundedUp(n) : null;
}

function matches(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

function SearchPicker<T extends { id: string }>({
  placeholder,
  items,
  filter,
  renderItem,
  onPick,
  onAdd,
}: {
  placeholder: string;
  items: T[];
  filter: (item: T, query: string) => boolean;
  renderItem: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
  onAdd?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => items.filter((i) => filter(i, query)).slice(0, 20), [items, query, filter]);

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputClassName}
      />
      <AnchoredDropdown
        anchorRef={inputRef}
        open={open}
        className="rounded-md border border-foreground/10 bg-background text-sm shadow-lg"
      >
          {results.length === 0 && !onAdd ? (
            <p className="px-3 py-2 text-foreground/40">Ничего не найдено</p>
          ) : (
            <>
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(item);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left hover:bg-foreground/5"
                >
                  {renderItem(item)}
                </button>
              ))}
              {onAdd &&
                query.trim() &&
                !items.some(
                  (item) =>
                    "sku" in item &&
                    typeof item.sku === "string" &&
                    item.sku.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
                ) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onAdd(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                  className="block w-full border-t border-foreground/10 px-3 py-1.5 text-left font-medium text-blue-600 hover:bg-foreground/5 dark:text-blue-400"
                >
                  <span>Добавить</span>
                  <span className="text-xs font-normal text-foreground/50">{query.trim()}</span>
                </button>
              )}
            </>
          )}
      </AnchoredDropdown>
    </div>
  );
}

const filterBuyer = (b: Buyer, q: string) =>
  b.customer
    ? matches(q, b.customer.name, b.customer.email, b.customer.phone, b.customer.companyName)
    : matches(q, b.company.name, b.company.inn);
const filterProduct = (p: Product, q: string) => matches(q, p.sku, p.name, p.brand);

/** The product's price for the order's price type; «Индивидуальный» = purchase + the company's markup (the shop price without a purchase). */
function priceOf(p: Product, type: PriceType, markup: number | null): number {
  if (type !== "individual") return p.prices[type];
  return p.purchase > 0 && markup !== null && p.prices.wholesale > 0 ? applyMarkup(p.purchase, markup) : p.prices.wholesale;
}

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, productId: "", offerId: "", quantity: "1", priceRub: "" });

export function NewOrderModal({
  onClose,
  mode = "crm",
}: {
  onClose: () => void;
  mode?: ManualOrderFormMode;
}) {
  const router = useRouter();
  const [data, setData] = useState<ManualOrderFormData | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [priceType, setPriceType] = useState<PriceType>("wholesale");
  // The picked buyer's company «Индивидуальный» markup, %.
  const [markup, setMarkup] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [settlement, setSettlement] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [terminal, setTerminal] = useState("");

  useEffect(() => {
    let active = true;
    getManualOrderFormData(mode)
      .then((formData) => {
        if (!active) return;
        setData(formData);
        if (mode === "replenishment") {
          const ownCompany = formData.companies.find((item) => item.isOwn);
          if (!ownCompany) {
            setError("Не найдена компания EMV для заказа пополнения");
            return;
          }
          setCompany(ownCompany);
          setCustomerName(ownCompany.name);
          setCustomerPhone(ownCompany.contactPhone);
          setCustomerEmail(ownCompany.contactEmail);
          setMarkup(ownCompany.markup);
          setPriceType(ownCompany.priceType === "individual" && ownCompany.markup === null ? "wholesale" : ownCompany.priceType);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные заказа");
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const productById = useMemo(() => new Map((data?.products ?? []).map((p) => [p.id, p])), [data]);
  const buyers = useMemo<Buyer[]>(
    () => [
      ...(data?.customers ?? []).map((c) => ({ id: `u:${c.id}`, customer: c })),
      ...(data?.companies ?? []).map((c) => ({ id: `c:${c.id}`, company: c })),
    ],
    [data]
  );

  function pickBuyer(b: Buyer) {
    // The company's «Тип цен» (card in CRM → Компании) becomes the order's.
    const terms = b.customer ?? b.company;
    setMarkup(terms.markup);
    changePriceType(terms.priceType === "individual" && terms.markup === null ? "wholesale" : terms.priceType, terms.markup);
    if (b.customer) {
      setCompany(null);
      setCustomer(b.customer);
      setCustomerName(b.customer.name);
      setCustomerPhone(b.customer.phone);
      setCustomerEmail(b.customer.email);
    } else {
      setCustomer(null);
      setCompany(b.company);
      setCustomerName(b.company.contactName || b.company.name);
      setCustomerPhone(b.company.contactPhone);
      setCustomerEmail(b.company.contactEmail);
    }
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function changePriceType(next: PriceType, withMarkup: number | null = markup) {
    setPriceType(next);
    setLines((prev) =>
      prev.map((l) => {
        const product = productById.get(l.productId);
        return product ? { ...l, priceRub: kopecksToRub(priceOf(product, next, withMarkup)) } : l;
      })
    );
  }

  const lineTotals = lines.map((l) => {
    const price = parseRub(l.priceRub);
    const qty = parseInt(l.quantity, 10);
    return price !== null && qty > 0 ? price * qty : 0;
  });
  const total = lineTotals.reduce((a, b) => a + b, 0);

  async function addUnknownSku(rawSku: string, lineKey: number) {
    setError(null);
    const result = await registerPendingProduct(rawSku);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData((current) => current && {
      ...current,
      products: [result.product, ...current.products],
    });
    updateLine(lineKey, { productId: result.product.id, priceRub: "0" });
  }

  function buildDeliveryNote(): string | undefined {
    if (!deliveryMethod) return undefined;
    const noteLines = [`Способ доставки: ${DELIVERY_LABELS[deliveryMethod]}`];
    if (deliveryMethod === "address") {
      if (settlement.trim()) noteLines.push(`Населённый пункт: ${settlement.trim()}`);
      if (street.trim()) noteLines.push(`Улица: ${street.trim()}`);
      if (house.trim()) noteLines.push(`Дом: ${house.trim()}`);
      if (apartment.trim()) noteLines.push(`Офис/квартира: ${apartment.trim()}`);
    }
    if (deliveryMethod === "terminal" && terminal.trim()) noteLines.push(`Терминал: ${terminal.trim()}`);
    return noteLines.join("\n");
  }

  async function handleSubmit() {
    setError(null);
    const filled = lines.filter((l) => l.productId);
    for (const line of filled) {
      if (parseRub(line.priceRub) === null) {
        setTab("items");
        return setError(`Укажите цену: ${productById.get(line.productId)?.name}`);
      }

    }
    setSubmitting(true);
    const input = {
      customerId: customer?.id,
      companyId: company?.id,
      customerName,
      customerPhone,
      customerEmail,
      deliveryNote: buildDeliveryNote(),
      items: filled.map((l) => ({
        productId: l.productId,
        offerId: l.offerId || undefined,
        quantity: parseInt(l.quantity, 10) || 0,
        price: parseRub(l.priceRub) ?? 0,
      })),
    };
    const result =
      mode === "replenishment"
        ? await createReplenishmentOrder(input)
        : await createManualOrder(input);
    setSubmitting(false);
    if (!result.ok) {
      if (/позиц|товар|Количество|Цена/.test(result.error)) setTab("items");
      return setError(result.error);
    }
    onClose();
    if (mode === "crm") {
      router.push(`/admin/crm/orders?orderNumber=${encodeURIComponent(result.orderNumber)}`);
    }
    router.refresh();
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl">
      <h2 className="text-xl font-bold">{mode === "replenishment" ? "Новое пополнение остатков" : "Новый заказ"}</h2>

      {!data ? (
        <p className={`mt-6 text-sm ${error ? "text-red-600" : "text-foreground/40"}`}>{error ?? "Загрузка..."}</p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            <div>
              <span className="text-sm text-foreground/60">Покупатель</span>
              {customer || company ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-foreground/20 px-3 py-2 text-sm">
                  {customer ? (
                    <span>
                      {customer.name} · {customer.email}
                      {customer.companyName && <span className="text-foreground/50"> · {customer.companyName}</span>}
                    </span>
                  ) : (
                    <span>
                      {company!.name}
                      <span className="text-foreground/50">
                        {company!.inn && ` · ИНН ${company!.inn}`} · контактные данные подставлены из карточки компании или аккаунта клиента
                      </span>
                    </span>
                  )}
                  {mode === "crm" && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer(null);
                        setCompany(null);
                      }}
                      className="text-foreground/40 hover:text-foreground"
                      aria-label="Сбросить покупателя"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  <SearchPicker
                    placeholder="Найти покупателя (ФИО, e-mail, телефон, компания, ИНН) или заполните поля ниже для нового"
                    items={buyers}
                    filter={filterBuyer}
                    onPick={pickBuyer}
                    renderItem={(b) =>
                      b.customer ? (
                        <>
                          {b.customer.name} <span className="text-foreground/50">· {b.customer.email}</span>
                          {b.customer.companyName && <span className="text-foreground/50"> · {b.customer.companyName}</span>}
                        </>
                      ) : (
                        <>
                          {b.company.name}
                          <span className="text-foreground/50">
                            {b.company.inn && ` · ИНН ${b.company.inn}`} · компания
                          </span>
                        </>
                      )
                    }
                  />
                </div>
              )}
            </div>

            {mode === "crm" && (
              <div className="grid grid-cols-3 gap-3">
                <input aria-label="ФИО покупателя" placeholder="ФИО *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClassName} />
                <input aria-label="Телефон покупателя" placeholder="Телефон *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClassName} />
                <input aria-label="E-mail покупателя" placeholder="E-mail *" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={inputClassName} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-sm text-foreground/60">Договор</span>
                <div className="mt-1 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm">
                  {(customer ?? company)?.contract ?? <span className="text-foreground/40">—</span>}
                </div>
              </div>
              <div>
                <label htmlFor="priceType" className="text-sm text-foreground/60">
                  Тип цены
                </label>
                <SearchSelect
                  id="priceType"
                  value={priceType}
                  onChange={(next) => changePriceType(next as PriceType)}
                  options={PRICE_TYPES.filter((t) => t !== "individual" || markup !== null).map((t) => ({
                    value: t,
                    label: `${PRICE_TYPE_LABELS[t]}${t === "individual" ? ` (+${markup}% к закупке)` : ""}`,
                  }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4 border-b border-foreground/10">
            {(["items", "delivery"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                  tab === t ? "border-foreground text-foreground" : "border-transparent text-foreground/50 hover:text-foreground"
                }`}
              >
                {t === "items" ? "Номенклатура" : "Доставка"}
              </button>
            ))}
          </div>

          {tab === "items" ? (
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-foreground/50">
                    <th className="pb-2 pr-3 font-normal">Товар</th>
                    <th className="w-24 pb-2 pr-3 font-normal">Кол-во</th>
                    <th className="w-32 pb-2 pr-3 font-normal">Цена, ₽</th>
                    <th className="w-32 pb-2 pr-3 text-right font-normal">Сумма</th>
                    <th className="w-8 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const product = productById.get(line.productId);
                    return (
                      <tr key={line.key} className="align-top">
                        <td className="py-1 pr-3">
                          {product ? (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-foreground/20 px-3 py-2">
                              <span>
                                {product.name}{" "}
                                <span className="text-foreground/50">
                                  · {product.sku} · остаток {product.stock}
                                  {!product.isActive && " · неактивен"}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => updateLine(line.key, { productId: "", offerId: "", priceRub: "" })}
                                className="text-foreground/40 hover:text-foreground"
                                aria-label="Сменить товар"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <SearchPicker
                              placeholder="Артикул, наименование или бренд"
                              items={data.products}
                              filter={filterProduct}
                              onPick={(p) => updateLine(line.key, {
                                productId: p.id,
                                offerId: p.supplierOffers.find((offer) => offer.selected)?.id ?? p.supplierOffers[0]?.id ?? "",
                                priceRub: kopecksToRub(priceOf(p, priceType, markup)),
                              })}
                              onAdd={mode === "crm" ? (sku) => void addUnknownSku(sku, line.key) : undefined}
                              renderItem={(p) => (
                                <>
                                  {p.name} <span className="text-foreground/50">· {p.sku} · {formatRub(priceOf(p, priceType, markup))}</span>
                                  {p.supplierOffers.length > 0 && (
                                    <span className="mt-1 block text-xs text-foreground/50">
                                      {p.supplierOffers.map((offer) => (
                                        <span key={offer.id} className="block">
                                          {offer.supplier?.name ?? "Поставщик"} · {formatSupplierCurrency(offer.quotedPrice ?? offer.price, parseSupplierCurrency(offer.currency) ?? "RUB")}
                                          {" · "}{offer.deliveryDays === null ? "срок не указан" : `${offer.deliveryDays} дн.`}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </>
                              )}
                            />
                          )}
                          {product && (
                            <div className="mt-1">
                              <label htmlFor={`supplier-offer-${line.key}`} className="mb-1 block text-xs text-foreground/50">
                                Вариант поставки
                              </label>
                              <SearchSelect
                                id={`supplier-offer-${line.key}`}
                                value={line.offerId}
                                onChange={(offerId) => updateLine(line.key, { offerId })}
                                emptyLabel="Поставщик не выбран"
                                options={product.supplierOffers.map((offer) => ({
                                  value: offer.id,
                                  label: `${offer.supplier?.name ?? "Поставщик"} · ${formatSupplierCurrency(offer.quotedPrice ?? offer.price, parseSupplierCurrency(offer.currency) ?? "RUB")}`,
                                  hint: `${offer.deliveryDays === null ? "срок не указан" : `${offer.deliveryDays} дн.`} · ${formatRub(offer.price)}`,
                                }))}
                                placeholder="Выберите поставщика и срок"
                                className="text-xs"
                              />
                              {product.supplierOffers.length === 0 && (
                                <p className="mt-1 text-xs text-foreground/50">Предложений поставщиков пока нет.</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-1 pr-3">
                          <input
                            aria-label="Количество"
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.key, { quantity: e.target.value.replace(/\D/g, "") })}
                            className={inputClassName}
                          />
                        </td>
                        <td className="py-1 pr-3">
                          <input
                            aria-label="Цена"
                            inputMode="decimal"
                            value={line.priceRub}
                            onChange={(e) => updateLine(line.key, { priceRub: e.target.value })}
                            className={inputClassName}
                          />
                        </td>
                        <td className="py-3 pr-3 text-right">{formatRub(lineTotals[index])}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : [emptyLine()]))}
                            className="text-red-600 hover:opacity-70"
                            aria-label="Удалить строку"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="mt-2 text-sm text-foreground/60 hover:text-foreground"
              >
                + Добавить строку
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-foreground/60">Способ доставки</span>
                <DeliveryMethodSelect value={deliveryMethod} onChange={setDeliveryMethod} />
              </div>
              {deliveryMethod === "terminal" && (
                <div className="flex items-center gap-3">
                  <label className="w-32 shrink-0 text-sm text-foreground/60">Терминал</label>
                  <SuggestField value={terminal} onChange={setTerminal} allOptions={DELLIN_TERMINALS} placeholder="Начните вводить адрес терминала" />
                </div>
              )}
              {deliveryMethod === "address" && (
                <>
                  <div className="flex items-center gap-3">
                    <label className="w-32 shrink-0 text-sm text-foreground/60">Населённый пункт</label>
                    <SuggestField value={settlement} onChange={setSettlement} allOptions={RU_CITIES} placeholder="Начните вводить населённый пункт" />
                  </div>
                  <div className="flex gap-3 pl-[8.75rem]">
                    <input aria-label="Улица" placeholder="Улица" value={street} onChange={(e) => setStreet(e.target.value)} className={inputClassName} />
                    <input aria-label="Дом" placeholder="Дом" value={house} onChange={(e) => setHouse(e.target.value)} className={inputClassName.replace("w-full", "w-24")} />
                    <input aria-label="Офис/квартира" placeholder="Офис/кв." value={apartment} onChange={(e) => setApartment(e.target.value)} className={inputClassName.replace("w-full", "w-28")} />
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex items-center justify-between border-t border-foreground/10 pt-4">
            <span className="text-sm">
              Итого: <strong>{formatRub(total)}</strong>
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Создаём..." : "Создать заказ"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
