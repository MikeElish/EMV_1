"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  deletePartnerStock,
  importPartnerStockFile,
  listPartnerStocks,
  savePartnerStock,
  type PartnerStockView,
} from "@/actions/admin/partner-network";
import { Modal } from "@/components/Modal";

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";
const filterClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs font-normal outline-none focus:border-foreground/50";

type Filters = { brand: string; name: string; sku: string; quantity: string; price: string; total: string; updated: string };
const EMPTY_FILTERS: Filters = { brand: "", name: "", sku: "", quantity: "", price: "", total: "", updated: "" };

type SupplierOption = { id: string; name: string; inn: string | null };

function formatRub(minor: number | null) {
  if (minor === null) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(minor / 100);
}

function dateTime(d: Date) {
  return new Date(d).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

export function PartnerNetworkTable({
  initialStocks,
  suppliers,
  canEdit,
}: {
  initialStocks: PartnerStockView[];
  suppliers: SupplierOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [stocks, setStocks] = useState(initialStocks);
  const [supplierId, setSupplierId] = useState<string>("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerStockView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!supplierId) {
      setStocks(initialStocks);
      return;
    }
    startTransition(async () => {
      const result = await listPartnerStocks(supplierId);
      setStocks(result);
    });
  }, [supplierId, initialStocks]);

  const filtered = useMemo(() => {
    return stocks.filter((s) => {
      const q = filters.quantity.trim();
      const p = filters.price.trim();
      const t = filters.total.trim();
      return (
        (!filters.brand || (s.brand ?? "").toLowerCase().includes(filters.brand.toLowerCase())) &&
        (!filters.name || (s.name ?? "").toLowerCase().includes(filters.name.toLowerCase())) &&
        (!filters.sku || (s.sku ?? "").toLowerCase().includes(filters.sku.toLowerCase())) &&
        (!q || String(s.quantity ?? "").includes(q)) &&
        (!p || String(s.price ?? "").includes(p)) &&
        (!t || String(s.total ?? "").includes(t)) &&
        (!filters.updated || dateTime(s.updatedAt).includes(filters.updated))
      );
    });
  }, [stocks, filters]);

  function openAdd() {
    setEditing(null);
    setIsAddOpen(true);
  }

  function openEdit(stock: PartnerStockView) {
    setEditing(stock);
    setIsAddOpen(true);
  }

  function openUpload() {
    setIsUploadOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <label className="text-sm text-foreground/60">Поставщик</label>
          <input
            list="partner-network-suppliers"
            value={suppliers.find((s) => s.id === supplierId)?.name ?? supplierId}
            onChange={(event) => {
              const value = event.target.value;
              const found = suppliers.find((s) => s.name === value || s.id === value);
              setSupplierId(found?.id ?? value);
            }}
            placeholder="Выберите или введите"
            className={inputClass}
          />
          <datalist id="partner-network-suppliers">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} data-id={s.id} />
            ))}
          </datalist>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openUpload}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Загрузить склад ПС
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-foreground/[0.03] text-left text-foreground/60">
            <tr>
              {[
                { key: "brand", label: "Бренд" },
                { key: "name", label: "Наименование" },
                { key: "sku", label: "Артикул" },
                { key: "quantity", label: "Количество" },
                { key: "price", label: "Цена" },
                { key: "total", label: "Всего" },
                { key: "updated", label: "Дата обновления" },
              ].map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  <div className="mb-1">{col.label}</div>
                  <input
                    value={filters[col.key as keyof Filters]}
                    onChange={(event) => setFilters((current) => ({ ...current, [col.key]: event.target.value }))}
                    className={filterClass}
                    placeholder="Поиск"
                  />
                </th>
              ))}
              {canEdit && <th className="px-3 py-2 font-medium">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-foreground/10 align-top">
                <td className="px-3 py-2">{s.brand ?? "—"}</td>
                <td className="max-w-xs px-3 py-2">{s.name ?? "—"}</td>
                <td className="px-3 py-2">{s.sku ?? "—"}</td>
                <td className="px-3 py-2">{s.quantity ?? "—"}</td>
                <td className="px-3 py-2">{formatRub(s.price)}</td>
                <td className="px-3 py-2">{formatRub(s.total)}</td>
                <td className="px-3 py-2">{dateTime(s.updatedAt)}</td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="text-sm text-foreground/70 hover:text-foreground"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm("Удалить строку?")) return;
                          startTransition(async () => {
                            const result = await deletePartnerStock(s.id);
                            if (!result.ok) setError(result.error);
                            else {
                              setStocks((current) => current.filter((item) => item.id !== s.id));
                              router.refresh();
                            }
                          });
                        }}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-3 py-6 text-center text-sm text-foreground/50">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isUploadOpen && (
        <UploadModal
          suppliers={suppliers}
          initialSupplierId={supplierId}
          onClose={() => setIsUploadOpen(false)}
          onDone={() => {
            setIsUploadOpen(false);
            router.refresh();
            startTransition(async () => setStocks(await listPartnerStocks(supplierId || null)));
          }}
        />
      )}

      {isAddOpen && (
        <EditModal
          suppliers={suppliers}
          initialSupplierId={supplierId}
          editing={editing}
          onClose={() => setIsAddOpen(false)}
          onDone={() => {
            setIsAddOpen(false);
            router.refresh();
            startTransition(async () => setStocks(await listPartnerStocks(supplierId || null)));
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  suppliers,
  initialSupplierId,
  onClose,
  onDone,
}: {
  suppliers: SupplierOption[];
  initialSupplierId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await importPartnerStockFile(form);
      if (!result.ok) setError(result.error);
      else onDone();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">Загрузить склад ПС</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm text-foreground/60">Поставщик *</label>
          <input
            list="upload-suppliers"
            value={suppliers.find((s) => s.id === supplierId)?.name ?? supplierId}
            onChange={(event) => {
              const value = event.target.value;
              const found = suppliers.find((s) => s.name === value || s.id === value);
              setSupplierId(found?.id ?? value);
            }}
            required
            className={inputClass}
          />
          <input type="hidden" name="supplierId" value={supplierId} />
          <datalist id="upload-suppliers">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} data-id={s.id} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Файл Excel/CSV</label>
          <input
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-foreground/20 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
          <p className="mt-2 text-xs text-foreground/50">
            Столбцы: <b>Бренд, Артикул, Количество, Цена</b>. Первая строка — заголовки.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Загрузка..." : "Загрузить файл"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium hover:bg-foreground/5">
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({
  suppliers,
  initialSupplierId,
  editing,
  onClose,
  onDone,
}: {
  suppliers: SupplierOption[];
  initialSupplierId: string;
  editing: PartnerStockView | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? initialSupplierId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      supplierId: String(form.get("supplierId") ?? ""),
      brand: String(form.get("brand") ?? ""),
      name: String(form.get("name") ?? ""),
      sku: String(form.get("sku") ?? ""),
      quantity: Number(form.get("quantity")),
      price: Math.round(Number(String(form.get("price")).replace(/\s/g, "").replace(",", ".")) * 100),
    };
    const total = data.quantity * data.price;
    setError(null);
    startTransition(async () => {
      const result = await savePartnerStock(editing?.id ?? null, { ...data, total });
      if (!result.ok) setError(result.error);
      else onDone();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{editing ? "Изменить строку" : "Добавить строку"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm text-foreground/60">Поставщик *</label>
          <input
            list="edit-suppliers"
            value={suppliers.find((s) => s.id === supplierId)?.name ?? supplierId}
            onChange={(event) => {
              const value = event.target.value;
              const found = suppliers.find((s) => s.name === value || s.id === value);
              setSupplierId(found?.id ?? value);
            }}
            required
            className={inputClass}
          />
          <input type="hidden" name="supplierId" value={supplierId} />
          <datalist id="edit-suppliers">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} data-id={s.id} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-foreground/60">Бренд</label>
            <input name="brand" defaultValue={editing?.brand ?? ""} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Артикул</label>
            <input name="sku" defaultValue={editing?.sku ?? ""} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Наименование</label>
          <input name="name" defaultValue={editing?.name ?? ""} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-foreground/60">Количество</label>
            <input name="quantity" type="number" min="0" step="1" defaultValue={editing?.quantity ?? ""} required className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Цена</label>
            <input
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={editing?.price ? (editing.price / 100).toFixed(2).replace(".", ",") : ""}
              required
              className={inputClass}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохранение..." : editing ? "Сохранить" : "Добавить"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium hover:bg-foreground/5">
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
