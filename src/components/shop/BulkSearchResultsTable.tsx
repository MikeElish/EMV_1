"use client";

import { useState } from "react";
import { utils, write } from "xlsx";
import type { Product } from "@prisma/client";
import type { MatchedBulkSearchRow } from "@/lib/bulk-search-match";
import { useCart } from "@/components/shop/CartProvider";
import { ProductQuickViewModal } from "@/components/shop/ProductQuickViewModal";

function availabilityLabel(row: MatchedBulkSearchRow): { text: string; className: string } {
  if (!row.product) return { text: "В запросе", className: "text-foreground/40" };
  if (row.product.stock <= 0) return { text: "Под заказ", className: "text-foreground/40" };
  const className =
    row.quantity <= row.product.stock ? "text-green-700 dark:text-green-500" : "text-red-600";
  return { text: String(row.product.stock), className };
}

function buildExportHref(rows: MatchedBulkSearchRow[]) {
  const header = ["Бренд", "Наименование", "Артикул", "Запрошено", "В наличии"];
  const body = rows.map((row) => [
    row.product?.brand ?? row.brand,
    row.product?.name ?? "",
    row.product?.sku ?? row.sku,
    row.quantity,
    availabilityLabel(row).text,
  ]);
  const worksheet = utils.aoa_to_sheet([header, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Результат поиска");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

function ResultRow({
  row,
  onQuickView,
}: {
  row: MatchedBulkSearchRow;
  onQuickView: (product: Product) => void;
}) {
  const { addItem } = useCart();
  const [ordering, setOrdering] = useState(false);
  const availability = availabilityLabel(row);
  const product = row.product;
  // "Под заказ" items (stock <= 0) aren't capped by an on-hand count.
  const maxQuantity = product && product.stock > 0 ? product.stock : 999;
  const [quantity, setQuantity] = useState(Math.min(Math.max(1, row.quantity), maxQuantity));
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    if (!product) return;
    addItem(
      { productId: product.id, slug: product.slug, sku: product.sku, name: product.name, price: product.price },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setOrdering(false);
    }, 1200);
  }

  return (
    <tr className="border-b border-foreground/10">
      <td className="py-2 pr-4">{product?.brand ?? row.brand}</td>
      <td className="py-2 pr-4">
        {product ? (
          <button type="button" onClick={() => onQuickView(product)} className="text-left hover:underline">
            {product.name}
          </button>
        ) : (
          <span className="text-foreground/40">—</span>
        )}
      </td>
      <td className="py-2 pr-4">
        {product ? (
          <button type="button" onClick={() => onQuickView(product)} className="hover:underline">
            {product.sku}
          </button>
        ) : (
          row.sku
        )}
      </td>
      <td className="py-2 pr-4 text-green-700 dark:text-green-500">{row.quantity}</td>
      <td className={`py-2 pr-4 ${availability.className}`}>{availability.text}</td>
      <td className="py-2 text-right">
        {!product ? (
          <span className="text-sm text-foreground/30">Недоступно</span>
        ) : ordering ? (
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center rounded-md border border-foreground/20">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-2 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Уменьшить количество"
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                className="px-2 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              {justAdded ? "Добавлено ✓" : "Подтвердить"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOrdering(true)}
            className="whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            Заказать
          </button>
        )}
      </td>
    </tr>
  );
}

export function BulkSearchResultsTable({ rows }: { rows: MatchedBulkSearchRow[] }) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const exportHref = buildExportHref(rows);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Результат поиска</h1>
        <a
          href={exportHref}
          download="rezultat-poiska.xlsx"
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Выгрузить результат
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-foreground/60">Ничего не найдено.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-foreground/50">
                <th className="py-2 pr-4">Бренд</th>
                <th className="py-2 pr-4">Наименование</th>
                <th className="py-2 pr-4">Артикул</th>
                <th className="py-2 pr-4">Запрошено</th>
                <th className="py-2 pr-4">В наличии</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <ResultRow key={i} row={row} onQuickView={setQuickViewProduct} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quickViewProduct && (
        <ProductQuickViewModal product={quickViewProduct} onRequestClose={() => setQuickViewProduct(null)} />
      )}
    </div>
  );
}
