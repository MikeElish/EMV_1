"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { utils, write } from "xlsx";
import type { Product, Category } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { deleteProduct } from "@/actions/admin/products";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { TableSearchInput } from "@/components/admin/TableSearchInput";

type ProductRow = Product & { category: Category };

function buildExportHref(products: ProductRow[]) {
  const header = ["Товар", "Артикул", "Категория", "Группа", "Цена", "Остаток", "Активен"];
  const body = products.map((product) => [
    product.name,
    product.sku,
    product.category.name,
    product.group ?? "",
    formatRub(product.price),
    product.stock,
    product.isActive ? "Да" : "Нет",
  ]);
  const worksheet = utils.aoa_to_sheet([header, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Товары");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState("");
  const exportHref = buildExportHref(products);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.category.name, product.group, product.brand]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Товары</h1>
        <div className="flex items-center gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по товарам..." />
          <Link
            href="/admin/crm/products/import"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Импорт CSV/Excel
          </Link>
          <Link
            href="/admin/crm/products/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Добавить товар
          </Link>
          <a
            href={exportHref}
            download="tovary.xlsx"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Выгрузить
          </a>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Товаров пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2">Товар</th>
              <th className="py-2">Категория</th>
              <th className="py-2">Группа</th>
              <th className="py-2">Цена</th>
              <th className="py-2">Остаток</th>
              <th className="py-2">Активен</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id} className="border-b border-foreground/10">
                <td className="py-2">
                  <div>{product.name}</div>
                  <div className="text-xs text-foreground/40">{product.sku}</div>
                </td>
                <td className="py-2 text-foreground/60">{product.category.name}</td>
                <td className="py-2 text-foreground/60">{product.group ?? "—"}</td>
                <td className="py-2">{formatRub(product.price)}</td>
                <td className="py-2">{product.stock}</td>
                <td className="py-2">
                  <ActiveToggle productId={product.id} isActive={product.isActive} />
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-4">
                    <Link
                      href={`/admin/crm/products/${product.id}/edit`}
                      className="hover:underline"
                    >
                      Изменить
                    </Link>
                    <DeleteButton
                      action={deleteProduct.bind(null, product.id)}
                      confirmText={`Удалить товар «${product.name}»?`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
