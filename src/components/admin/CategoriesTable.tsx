"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Category } from "@prisma/client";
import { updateCategory, deleteCategory } from "@/actions/admin/categories";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";

type CategoryRow = Category & { _count: { products: number } };

export function CategoriesTable({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CategoryRow | null>(null);
  const [search, setSearch] = useState("");

  function close() {
    setSelected(null);
    router.refresh();
  }

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
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/categories/new"
            aria-label="Добавить категорию"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </Link>
          <h1 className="text-lg font-semibold">Категории</h1>
        </div>
        <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по категориям..." />
      </div>

      {categories.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Категорий пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2">Название</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Товаров</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((category) => (
              <tr
                key={category.id}
                onClick={() => setSelected(category)}
                className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
              >
                <td className="py-2">{category.name}</td>
                <td className="py-2 text-foreground/50">{category.slug}</td>
                <td className="py-2">{category._count.products}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-md">
          <h2 className="text-xl font-bold">Категория: {selected.name}</h2>
          <CategoryForm
            initial={{ name: selected.name, slug: selected.slug }}
            onSubmit={(input) => updateCategory(selected.id, input)}
            onSuccess={close}
          />

          <div className="mt-6 flex justify-end">
            <DeleteButton
              action={async () => {
                const result = await deleteCategory(selected.id);
                if (result.ok) close();
                return result;
              }}
              confirmText={`Удалить категорию «${selected.name}»?`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
