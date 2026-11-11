"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addManualSupplierOrderLine, getManualSupplierOrderFormData } from "@/actions/admin/supplier-orders";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";

export function AddSupplierOrderLineModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getManualSupplierOrderFormData>> | null>(null);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [purchaseTarget, setPurchaseTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManualSupplierOrderFormData().then(setData).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить список товаров");
    });
  }, []);

  const products = useMemo(() => data?.products ?? [], [data]);
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ru");
    return products
      .filter((product) =>
        !value ||
        product.sku.toLocaleLowerCase("ru").includes(value) ||
        product.name.toLocaleLowerCase("ru").includes(value) ||
        (product.brand ?? "").toLocaleLowerCase("ru").includes(value)
      )
      .slice(0, 25);
  }, [products, query]);
  const selected = products.find((product) => product.id === productId);

  async function save() {
    if (!productId) return setError("Выберите товар");
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1) return setError("Укажите количество");
    const rubles = parseFloat(price.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(rubles) || rubles < 0) return setError("Укажите цену от нуля");
    setPending(true);
    setError(null);
    const result = await addManualSupplierOrderLine(
      productId,
      supplierId,
      count,
      rublesToKopecksRoundedUp(rubles),
      purchaseTarget
    );
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="w-[32rem] max-w-full space-y-3">
        <h2 className="text-lg font-semibold">Добавить позицию поставщику</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data ? (
          <p className="text-sm text-foreground/50">Загрузка товаров…</p>
        ) : (
          <>
            <div>
              <label className="text-sm text-foreground/60">Товар</label>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Артикул / наименование"
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2"
              />
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-foreground/10">
                {filtered.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setProductId(product.id);
                      setQuery(`${product.sku} — ${product.name}`);
                      setPrice((product.purchasePrice / 100).toFixed(2).replace(/\.00$/, ""));
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-foreground/5 ${product.id === productId ? "bg-foreground/10" : ""}`}
                  >
                    {product.sku} — {product.name} {product.brand ? `(${product.brand})` : ""} · в наличии {product.stock}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-foreground/60">Поставщик</label>
              <SearchSelect
                value={supplierId}
                onChange={setSupplierId}
                emptyLabel="Не выбран"
                options={data.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                placeholder="Название поставщика"
                className="mt-1"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-foreground/60">Количество</label>
                <input value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="text-sm text-foreground/60">Цена закупки, ₽</label>
                <input value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2" />
              </div>
            </div>
            <div>
              <label htmlFor="buyer-order-number" className="text-sm text-foreground/60">
                Привязка закупки
              </label>
              <SearchSelect
                id="buyer-order-number"
                value={purchaseTarget}
                onChange={setPurchaseTarget}
                emptyLabel="— без привязки к заказу —"
                options={[
                  { value: "warehouse", label: "На склад", hint: "Пополнение остатков" },
                  ...data.buyerOrders.map((order) => ({
                    value: `order:${order.orderNumber}`,
                    label: `Заказ № ${order.orderNumber}`,
                    hint: `${order.customerName} · ${new Date(order.createdAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`,
                  })),
                ]}
                placeholder="Заказ покупателя или «На склад»"
                className="mt-1"
              />
              {data.buyerOrders.length === 0 && (
                <p className="mt-1 text-xs text-foreground/50">Нет заказов покупателей с незакрытыми позициями.</p>
              )}
            </div>
            {selected && <p className="text-xs text-foreground/50">В наличии: {selected.stock} шт. · цена закупки {formatRub(selected.purchasePrice)}</p>}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm">Отмена</button>
          <button type="button" onClick={() => void save()} disabled={pending || !data || !productId} className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">
            {pending ? "Сохраняем…" : "Добавить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
