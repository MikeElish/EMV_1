"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getManualOrderFormData, type ManualOrderFormData } from "@/actions/admin/manual-order";
import { addOrderItem } from "@/actions/admin/orders";
import { Modal } from "@/components/Modal";
import { rublesToKopecksRoundedUp, formatRub } from "@/lib/money";

type Order = { id: string; orderNumber: string };

export function AddOrderItemModal({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<ManualOrderFormData | null>(null);
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceRub, setPriceRub] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManualOrderFormData().then(setData).catch(() => setError("Не удалось загрузить товары"));
  }, []);

  const products = useMemo(() => data?.products ?? [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, query]);

  const selected = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selected && !priceRub) {
      setPriceRub((selected.prices.wholesale / 100).toFixed(2).replace(/\.00$/, ""));
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!orderId || !productId) return setError("Выберите заказ и товар");
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) return setError("Количество");
    const price = rublesToKopecksRoundedUp(parseFloat(priceRub.replace(",", ".")));
    if (!Number.isFinite(price) || price <= 0) return setError("Цена");
    setSaving(true);
    const result = await addOrderItem(orderId, productId, qty, price);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="w-[32rem] max-w-full space-y-3">
        <h2 className="text-lg font-semibold">Добавить товар в заказ</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="text-sm text-foreground/60">Заказ</label>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2">
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                № {o.orderNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Товар</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Артикул / наименование" className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2" />
          <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-foreground/10">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id);
                  setQuery(`${p.sku} — ${p.name}`);
                  setPriceRub((p.prices.wholesale / 100).toFixed(2).replace(/\.00$/, ""));
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-foreground/5 ${productId === p.id ? "bg-foreground/10" : ""}`}
              >
                {p.sku} — {p.name} {p.brand ? `(${p.brand})` : ""} · в наличии {p.stock}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm text-foreground/60">Количество</label>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2" />
          </div>
          <div className="flex-1">
            <label className="text-sm text-foreground/60">Цена, ₽</label>
            <input value={priceRub} onChange={(e) => setPriceRub(e.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2" />
          </div>
        </div>
        {selected && (
          <p className="text-xs text-foreground/50">
            Розница {formatRub(selected.prices.retail)}, опт {formatRub(selected.prices.wholesale)}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm">
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !orderId || !productId}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {saving ? "Сохраняем…" : "Добавить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
