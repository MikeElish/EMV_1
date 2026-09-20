"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category } from "@prisma/client";
import { deleteCategory } from "@/actions/admin/categories";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TableSearchInput } from "@/components/admin/TableSearchInput";

type CategoryRow = Category & { _count: { products: number } };

export function CategoriesTable({ categories }: { categories: CategoryRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) =>
      [category.name, category.slug].join(" ").toLowerCase().includes(query)
    );
  }, [categories, search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Категории</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/categories/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Добавить категорию
          </Link>
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по категориям..." />
        </div>
      </div>

      {categories.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Категорий пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2">Название</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Товаров</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((category) => (
              <tr key={category.id} className="border-b border-foreground/10">
                <td className="py-2">{category.name}</td>
                <td className="py-2 text-foreground/50">{category.slug}</td>
                <td className="py-2">{category._count.products}</td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-4">
                    <Link
                      href={`/admin/crm/categories/${category.id}/edit`}
                      className="hover:underline"
                    >
                      Изменить
                    </Link>
                    <DeleteButton
                      action={deleteCategory.bind(null, category.id)}
                      confirmText={`Удалить категорию «${category.name}»?`}
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
