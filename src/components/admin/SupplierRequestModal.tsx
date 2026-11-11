"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { getSupplierRequestData, submitSupplierRequests, type SupplierRequestData } from "@/actions/admin/supplier-requests";
import { formatSupplierCurrency } from "@/lib/supplier-currency";

type Tab = "request" | "order";

export function SupplierRequestModal({ lineIds, onClose }: { lineIds: string[]; onClose: () => void }) {
  const lineIdsKey = JSON.stringify(lineIds);
  const [data, setData] = useState<SupplierRequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("request");
  const [addedSupplierIds, setAddedSupplierIds] = useState<string[]>([]);
  const [supplierToAdd, setSupplierToAdd] = useState("");
  const [selectedQuoteKeys, setSelectedQuoteKeys] = useState<Set<string>>(new Set());
  const [selectedPurchaseKeys, setSelectedPurchaseKeys] = useState<Set<string>>(new Set());
  const [expandedPurchaseKeys, setExpandedPurchaseKeys] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<{ supplier: string; type: "КП" | "Счёт"; url: string }[]>([]);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getSupplierRequestData(JSON.parse(lineIdsKey) as string[]).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setData(result.data);
      setSelectedQuoteKeys(new Set(result.data.orders.flatMap((order) =>
        order.brands.flatMap((brand) =>
          brand.supplierIds
            .filter((supplierId) => !order.requestedSupplierIds.includes(supplierId))
            .map((supplierId) => quoteKey(order.number, brand.brand, supplierId))
        )
      )));
    }).catch((reason: unknown) => {
      if (active) {
        setLoading(false);
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить список запросов");
      }
    });
    return () => {
      active = false;
    };
  // The parent derives lineIds from filtered rows; use the serialized value to avoid
  // reloading and resetting choices when an unrelated parent state changes.
  }, [lineIdsKey]);

  const supplierById = useMemo(() => new Map(data?.suppliers.map((supplier) => [supplier.id, supplier]) ?? []), [data]);
  const availableSupplierOptions = useMemo(
    () => {
      const existingSupplierIds = new Set(allSupplierIds(data));
      return (data?.suppliers ?? [])
        .filter((supplier) => !existingSupplierIds.has(supplier.id) && !addedSupplierIds.includes(supplier.id))
        .map((supplier) => ({ value: supplier.id, label: supplier.name, hint: supplier.hasEmail ? undefined : "нет e-mail" }));
    },
    [data, addedSupplierIds]
  );
  const supplierIds = useMemo(
    () => [...new Set([...(data ? allSupplierIds(data) : []), ...addedSupplierIds])],
    [data, addedSupplierIds]
  );

  function addSupplier() {
    if (!supplierToAdd) return;
    setAddedSupplierIds((current) => [...new Set([...current, supplierToAdd])]);
    setSupplierToAdd("");
  }

  function toggleQuote(orderNumber: string, brand: string, supplierId: string) {
    const key = quoteKey(orderNumber, brand, supplierId);
    setSelectedQuoteKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePurchase(key: string) {
    setSelectedPurchaseKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpandedPurchaseKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function send() {
    if (!data) return;
    const selectedQuotes = [...selectedQuoteKeys].map((key) => {
      const [orderNumber, brand, supplierId] = JSON.parse(key) as [string, string, string];
      return { orderNumber, brand, supplierId };
    });
    const selectedLineIds = data.purchases
      .filter((purchase) => selectedPurchaseKeys.has(purchase.id))
      .flatMap((purchase) => purchase.lineIds);
    if (!selectedQuotes.length && !selectedLineIds.length) {
      setError("Выберите поставщиков или заказы");
      return;
    }
    const quoteCount = selectedQuotes.length;
    const purchaseCount = selectedPurchaseKeys.size;
    const confirmation = [
      quoteCount ? `запросов КП: ${quoteCount}` : "",
      purchaseCount ? `заказов поставщикам: ${purchaseCount}` : "",
    ].filter(Boolean).join(", ");
    if (!window.confirm(`Отправить поставщикам (${confirmation})? Письма будут отправлены только после этого подтверждения.`)) return;
    setError(null);
    setLinks([]);
    setSendErrors([]);
    startTransition(async () => {
      try {
        const result = await submitSupplierRequests({ quotes: selectedQuotes, purchaseLineIds: selectedLineIds });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setLinks(result.links);
        setSendErrors(result.errors);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Не удалось отправить запросы");
      }
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-7xl" widthClassName="w-[96vw]" maxHeightClassName="max-h-[92vh]" title="Запрос поставщикам">
      <h2 className="shrink-0 text-xl font-semibold">Запрос поставщикам</h2>
      {loading ? (
        <p className="mt-6 text-sm text-foreground/50">Загружаем заказы и предложения...</p>
      ) : error && !data ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : data ? (
        <>
          <div className="mt-4 flex shrink-0 gap-2 border-b border-foreground/10">
            <button type="button" onClick={() => setTab("request")} className={tabClass(tab === "request")}>В запросе</button>
            <button type="button" onClick={() => setTab("order")} className={tabClass(tab === "order")}>Заказать</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-4">
            {tab === "request" ? (
              data.orders.length === 0 ? (
                <p className="text-sm text-foreground/50">Нет позиций в статусе «Проверка заказа» для выбранных заказов.</p>
              ) : (
                <>
                  <div className="overflow-auto rounded-lg border border-foreground/10">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-background text-left text-foreground/60">
                        <tr>
                          <th className="sticky left-0 z-20 min-w-36 bg-background px-3 py-2">Номер заказа</th>
                          <th className="sticky left-36 z-20 min-w-40 bg-background px-3 py-2">Бренд</th>
                          {supplierIds.map((supplierId) => (
                            <th key={supplierId} className="min-w-40 border-l border-foreground/10 px-3 py-2">
                              {supplierById.get(supplierId)?.name ?? "Поставщик"}
                              {!supplierById.get(supplierId)?.hasEmail && <div className="text-xs text-red-600">нет e-mail</div>}
                            </th>
                          ))}
                          <th className="min-w-64 border-l border-foreground/10 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <SearchSelect
                                value={supplierToAdd}
                                onChange={setSupplierToAdd}
                                options={availableSupplierOptions}
                                emptyLabel="Выберите поставщика"
                                placeholder="Поиск поставщика"
                                className="min-w-40 text-xs"
                              />
                              <button
                                type="button"
                                disabled={!supplierToAdd}
                                onClick={addSupplier}
                                className="whitespace-nowrap rounded-md border border-foreground/20 px-2 py-1 text-xs disabled:opacity-40"
                              >
                                Добавить поставщика
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.flatMap((order) => order.brands.map((brand) => (
                          <tr key={`${order.number}-${brand.brand}`} className="border-t border-foreground/10">
                            <td className="sticky left-0 bg-background px-3 py-2">{order.number}</td>
                            <td className="sticky left-36 bg-background px-3 py-2">
                              <div>{brand.brand}</div>
                              <div className="text-xs text-foreground/50">{brand.productCount} поз. · {brand.quantity} шт.</div>
                            </td>
                            {supplierIds.map((supplierId) => {
                              const requested = order.requestedSupplierIds.includes(supplierId);
                              const checked = selectedQuoteKeys.has(quoteKey(order.number, brand.brand, supplierId));
                              return (
                                <td key={supplierId} className="border-l border-foreground/10 px-3 py-2 text-center">
                                  {requested ? (
                                    <span className="text-xs text-foreground/40">Уже запрошен</span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      aria-label={`${order.number}, ${brand.brand}, ${supplierById.get(supplierId)?.name ?? "поставщик"}`}
                                      onChange={() => toggleQuote(order.number, brand.brand, supplierId)}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="border-l border-foreground/10 px-3 py-2" />
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : (
              <>
                {data.missingSupplierCount > 0 && (
                  <p className="mb-3 text-sm text-amber-700">Не выбраны поставщики для позиций: {data.missingSupplierCount}.</p>
                )}
                {data.purchases.length === 0 ? (
                  <p className="text-sm text-foreground/50">Нет несформированных заказов поставщикам среди выбранных строк.</p>
                ) : (
                  <div className="overflow-auto rounded-lg border border-foreground/10">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="sticky top-0 z-10 bg-background text-left text-foreground/60">
                        <tr>
                          <th className="px-3 py-2">Заказы / назначение</th>
                          <th className="px-3 py-2">Поставщик</th>
                          <th className="px-3 py-2 text-right">Сумма</th>
                          <th className="px-3 py-2 text-right">Срок поставки</th>
                          <th className="px-3 py-2 text-center">Заказать</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.purchases.map((purchase) => {
                          const expanded = expandedPurchaseKeys.has(purchase.id);
                          return (
                            <FragmentRows key={purchase.id}>
                              <tr
                                className="cursor-pointer border-t border-foreground/10 hover:bg-foreground/[0.03]"
                                onClick={() => toggleExpanded(purchase.id)}
                              >
                                <td className="px-3 py-2">
                                  {[...(purchase.forStock ? ["На склад"] : []), ...purchase.orderNumbers.map((number) => `№ ${number}`)].join(", ") || "—"}
                                </td>
                                <td className="px-3 py-2">{purchase.supplier}</td>
                                <td className="px-3 py-2 text-right">{formatSupplierCurrency(purchase.amount, purchase.currency)}</td>
                                <td className="px-3 py-2 text-right">{purchase.deliveryDays === null ? "—" : `${purchase.deliveryDays} дн.`}</td>
                                <td className="px-3 py-2 text-center" onClick={(event) => event.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedPurchaseKeys.has(purchase.id)}
                                    aria-label={`Заказать у ${purchase.supplier}, заказ ${purchase.orderNumber ?? ""}`}
                                    onChange={() => togglePurchase(purchase.id)}
                                  />
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="border-t border-foreground/10 bg-foreground/[0.02]">
                                  <td colSpan={5} className="px-5 py-3">
                                    <table className="w-full text-xs">
                                      <thead className="text-left text-foreground/50">
                                        <tr>
                                          <th className="pb-2">Наименование</th>
                                          <th className="pb-2">Артикул</th>
                                          <th className="pb-2">Назначение</th>
                                          <th className="pb-2 text-right">Количество</th>
                                          <th className="pb-2 text-right">Цена</th>
                                          <th className="pb-2 text-right">Стоимость</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {purchase.lines.map((line, index) => (
                                          <tr key={`${line.sku}-${index}`}>
                                            <td className="py-1">{line.name}</td>
                                            <td className="py-1">{line.sku}</td>
                                            <td className="py-1">{line.source}</td>
                                            <td className="py-1 text-right">{line.quantity}</td>
                                            <td className="py-1 text-right">{formatSupplierCurrency(line.price, purchase.currency)}</td>
                                            <td className="py-1 text-right">{formatSupplierCurrency(line.price * line.quantity, purchase.currency)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </FragmentRows>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          {(error || links.length > 0 || sendErrors.length > 0) && (
            <div className="max-h-32 shrink-0 overflow-auto border-t border-foreground/10 py-3 text-sm">
              {error && <p className="text-red-600">{error}</p>}
              {sendErrors.map((message) => <p key={message} className="text-red-600">{message}</p>)}
              {links.map((link) => (
                <p key={link.url}>
                  {link.supplier} · {link.type}: <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{link.url}</a>
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 flex shrink-0 items-center gap-2">
            <button type="button" disabled={pending} onClick={send} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "Отправляем..." : "Отправить"}
            </button>
            <button type="button" onClick={onClose} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
              Отменить
            </button>
            {data.missingSupplierCount > 0 && <span className="ml-auto text-xs text-foreground/50">Позиции без поставщика не отправляются.</span>}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function allSupplierIds(data: SupplierRequestData | null) {
  return [...new Set(data?.orders.flatMap((order) => order.brands.flatMap((brand) => brand.supplierIds)) ?? [])];
}

function quoteKey(orderNumber: string, brand: string, supplierId: string) {
  return JSON.stringify([orderNumber, brand, supplierId]);
}

function tabClass(active: boolean) {
  return `border-b-2 px-4 py-2 text-sm font-medium ${active ? "border-foreground text-foreground" : "border-transparent text-foreground/50 hover:text-foreground"}`;
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
