"use client";

import { CrmPage, CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Brand } from "@prisma/client";
import { updateBrand, deleteBrand, setBrandActive } from "@/actions/admin/brands";
import { BrandForm } from "@/components/admin/BrandForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type BrandRow = Brand & { productCount: number; inStockCount: number };

export function BrandsTable({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<BrandRow | null>(null);
  const [search, setSearch] = useRememberedState("brandSearch", "");

  function close() {
    setSelected(null);
    router.refresh();
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return brands;
    return brands.filter((brand) =>
      [brand.name, brand.slug].join(" ").toLowerCase().includes(query)
    );
  }, [brands, search]);

  return (
    <CrmPage>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/brands/new"
            aria-label="Добавить бренд"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </Link>
          <h1 className="text-lg font-semibold">Бренды</h1>
        </div>
        <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по брендам..." />
      </div>

      {brands.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Брендов пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <CrmTableScroll>
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="border-b border-foreground/10 text-left text-foreground/50">
                <th className="py-2">Название</th>
                <th className="py-2">Slug</th>
                <th className="py-2">Номенклатура</th>
                <th className="py-2">В наличии (шт.)</th>
                <th className="py-2">На сайте</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((brand) => (
                <tr
                  key={brand.id}
                  onClick={() => setSelected(brand)}
                  className={`cursor-pointer border-b border-foreground/10 hover:bg-foreground/5 ${
                    brand.isActive ? "" : "text-foreground/50"
                  }`}
                >
                  <td className="py-2">{brand.name}</td>
                  <td className="py-2 text-foreground/50">{brand.slug}</td>
                  <td className="py-2">{brand.productCount}</td>
                  <td className="py-2">{brand.inStockCount}</td>
                  <td className="py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={brand.isActive}
                        onChange={async (e) => {
                          e.stopPropagation();
                          await setBrandActive(brand.id, e.target.checked);
                          router.refresh();
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs">{brand.isActive ? "Да" : "Нет"}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-md">
          <h2 className="text-xl font-bold">Бренд: {selected.name}</h2>
          <BrandForm
            initial={{ name: selected.name, slug: selected.slug, isActive: selected.isActive }}
            onSubmit={(input) => updateBrand(selected.id, input)}
            onSuccess={close}
          />

          <div className="mt-6 flex justify-end">
            <DeleteButton
              action={async () => {
                const result = await deleteBrand(selected.id);
                if (result.ok) close();
                return result;
              }}
              confirmText={`Удалить бренд «${selected.name}»?`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            />
          </div>
        </Modal>
      )}
    </CrmPage>
  );
}
