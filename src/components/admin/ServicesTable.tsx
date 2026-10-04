"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import type { Service } from "@prisma/client";
import { formatRub } from "@/lib/money";
import {
  deleteService,
  importOneCService,
  listOneCServices,
  saveService,
  toggleServiceActive,
  type OneCServicesResult,
} from "@/actions/admin/services";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { Modal } from "@/components/Modal";

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";

function ServiceForm({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = Number(String(form.get("price") ?? "0").replace(",", ".").replace(/\s/g, ""));
    if (!Number.isFinite(price)) {
      setError("Некорректная цена");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveService(service?.id ?? null, {
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? ""),
        unit: String(form.get("unit") ?? ""),
        price: Math.round(price * 100),
        description: String(form.get("description") ?? ""),
        isActive: form.get("isActive") === "on",
      });
      if (!result.ok) setError(result.error);
      else onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{service ? "Изменить услугу" : "Новая услуга"}</h2>
      {service?.oneCRef && <p className="mt-1 text-xs text-foreground/50">Карточка связана с 1С</p>}
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="service-name" className="text-sm text-foreground/60">
            Наименование *
          </label>
          <input id="service-name" name="name" required defaultValue={service?.name} className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="service-code" className="text-sm text-foreground/60">
              Код / артикул
            </label>
            <input id="service-code" name="code" defaultValue={service?.code ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="service-unit" className="text-sm text-foreground/60">
              Ед. изм.
            </label>
            <input id="service-unit" name="unit" defaultValue={service?.unit ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="service-price" className="text-sm text-foreground/60">
              Цена, ₽
            </label>
            <input
              id="service-price"
              name="price"
              inputMode="decimal"
              defaultValue={service ? String(service.price / 100) : "0"}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="service-description" className="text-sm text-foreground/60">
            Описание
          </label>
          <textarea
            id="service-description"
            name="description"
            rows={3}
            defaultValue={service?.description ?? ""}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={service?.isActive ?? true} /> Активна
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Сохраняем..." : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}

/** Services of 1С not yet on the site, one click each to copy. */
function OneCImport({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<OneCServicesResult | null>(null);
  const [filter, setFilter] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOneCServices().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(ref: string) {
    setBusyRef(ref);
    setError(null);
    const r = await importOneCService(ref);
    setBusyRef(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult((prev) =>
      prev?.ok ? { ok: true, services: prev.services.map((s) => (s.ref === ref ? { ...s, added: true } : s)) } : prev
    );
  }

  const query = filter.trim().toLowerCase();
  const services = result?.ok
    ? result.services.filter((s) => !query || `${s.name} ${s.code} ${s.group}`.toLowerCase().includes(query))
    : [];

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">Услуги из 1С</h2>
      {result === null ? (
        <p className="mt-4 text-sm text-foreground/50">Загружаем справочник номенклатуры 1С...</p>
      ) : !result.ok ? (
        <p className="mt-4 text-sm text-red-600">{result.error}</p>
      ) : (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск по услугам 1С..."
            className={`${inputClass} mt-4`}
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {services.map((s) => (
                  <tr key={s.ref} className="border-b border-foreground/10">
                    <td className="py-2 pr-3">
                      <div>{s.name}</div>
                      <div className="text-xs text-foreground/50">
                        {[s.code, s.group, s.unit].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      {s.added ? (
                        <span className="text-xs text-green-600">✓ на сайте</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyRef !== null}
                          onClick={() => add(s.ref)}
                          className="rounded-md border border-foreground/20 px-3 py-1 text-xs font-medium hover:bg-foreground/5 disabled:opacity-50"
                        >
                          {busyRef === s.ref ? "..." : "Добавить"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length === 0 && <p className="py-4 text-sm text-foreground/50">Ничего не найдено.</p>}
          </div>
        </>
      )}
    </Modal>
  );
}

function ActiveSwitch({ service }: { service: Service }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await toggleServiceActive(service.id, !service.isActive)))}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        service.isActive ? "bg-green-600/10 text-green-700 dark:text-green-500" : "bg-foreground/10 text-foreground/50"
      }`}
    >
      {service.isActive ? "Да" : "Нет"}
    </button>
  );
}

export function ServicesTable({ services }: { services: Service[] }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return services;
    return services.filter((s) =>
      [s.name, s.code, s.unit].filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [services, search]);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">Услуги</h1>
        <div className="flex items-center gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по услугам..." />
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Загрузить из 1С
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Добавить услугу
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Услуг пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <CrmTableScroll className="mt-6">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Услуга</th>
                <th className="py-2 pr-3">Ед. изм.</th>
                <th className="py-2 pr-3">Цена</th>
                <th className="py-2 pr-3">1С</th>
                <th className="py-2 pr-3">Активна</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
                    setEditing(s);
                  }}
                  className="cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/5"
                >
                  <td className="py-2 pr-3">
                    <div>{s.name}</div>
                    {s.code && <div className="text-xs text-foreground/40">{s.code}</div>}
                  </td>
                  <td className="py-2 pr-3 text-foreground/60">{s.unit ?? "—"}</td>
                  <td className="py-2 pr-3 font-medium">{formatRub(s.price)}</td>
                  <td className="py-2 pr-3 text-foreground/60">{s.oneCRef ? "✓" : "—"}</td>
                  <td className="py-2 pr-3">
                    <ActiveSwitch service={s} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <div className="flex justify-end gap-4">
                      <button type="button" onClick={() => setEditing(s)} className="hover:underline">
                        Изменить
                      </button>
                      <DeleteButton
                        action={deleteService.bind(null, s.id)}
                        confirmText={`Удалить услугу «${s.name}»?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {editing && <ServiceForm service={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {importing && <OneCImport onClose={() => setImporting(false)} />}
    </>
  );
}
