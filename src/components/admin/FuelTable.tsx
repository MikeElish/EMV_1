"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { FuelType } from "@prisma/client";
import { formatRubPrecise } from "@/lib/money";
import { FUEL_LABELS, FUEL_TYPES, VAT_RATES, vatLabel } from "@/lib/fuel";
import { createFuelReceipt, deleteFuelReceipt } from "@/actions/admin/fuel";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FitWidth } from "@/components/FitWidth";
import { Modal } from "@/components/Modal";
import { SuggestField } from "@/components/SuggestField";

export type FuelRow = {
  id: string;
  date: Date;
  driverName: string;
  vehicle: { brand: string; model: string; licensePlate: string };
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  vatRate: number | null;
  stationInn: string;
  stationName: string;
  fileName: string;
  fileUrl: string;
};

export type VehicleOption = { id: string; label: string; plate: string };
export type StationOption = { inn: string; name: string };

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";

const formatLiters = (l: number) => `${l.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} л`;
const formatDate = (d: Date) => new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

function todayInMoscow() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
}

function NewFuelReceipt({
  vehicles,
  drivers,
  stations,
  onClose,
}: {
  vehicles: VehicleOption[];
  drivers: string[];
  stations: StationOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [driverName, setDriverName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [inn, setInn] = useState("");
  const [stationName, setStationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const plate = vehicles.find((v) => v.id === vehicleId)?.plate ?? "";
  const toNumber = (s: string) => Number(s.replace(",", ".").replace(/\s/g, ""));
  const total = toNumber(liters) > 0 && toNumber(price) > 0 ? Math.round(toNumber(liters) * Math.round(toNumber(price) * 100)) : 0;

  // A known station: its INN fills in the name (and the other way round).
  function pickInn(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    setInn(digits);
    const known = stations.find((s) => s.inn === digits);
    if (known && !stationName) setStationName(known.name);
  }
  function pickName(value: string) {
    setStationName(value);
    const known = stations.find((s) => s.name === value);
    if (known) setInn(known.inn);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("driverName", driverName);
    form.set("stationInn", inn);
    form.set("stationName", stationName);
    setError(null);
    startTransition(async () => {
      const result = await createFuelReceipt(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <h2 className="text-lg font-semibold">Новая заправка</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="fuel-date" className="text-sm text-foreground/60">
              Дата *
            </label>
            <input id="fuel-date" name="date" type="date" required defaultValue={todayInMoscow()} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-foreground/60">Водитель *</label>
            <div className="mt-1 flex">
              <SuggestField value={driverName} onChange={setDriverName} allOptions={drivers} placeholder="ФИО водителя" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="fuel-vehicle" className="text-sm text-foreground/60">
              Машина *
            </label>
            <select
              id="fuel-vehicle"
              name="vehicleId"
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={inputClass}
            >
              <option value="">Выберите из «Техники»</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-foreground/60">Гос.номер</label>
            <p className="mt-1 rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm">{plate || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="fuel-type" className="text-sm text-foreground/60">
              Топливо *
            </label>
            <select id="fuel-type" name="fuelType" required defaultValue="AI95" className={inputClass}>
              {FUEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FUEL_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fuel-liters" className="text-sm text-foreground/60">
              Литров *
            </label>
            <input
              id="fuel-liters"
              name="liters"
              required
              inputMode="decimal"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fuel-price" className="text-sm text-foreground/60">
              Цена за 1 л, ₽ *
            </label>
            <input
              id="fuel-price"
              name="pricePerLiter"
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fuel-vat" className="text-sm text-foreground/60">
              Ставка НДС *
            </label>
            <select id="fuel-vat" name="vatRate" required defaultValue="22" className={inputClass}>
              {VAT_RATES.map((r) => (
                <option key={String(r)} value={r === null ? "none" : String(r)}>
                  {vatLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm">
          Итого: <span className="font-semibold">{formatRubPrecise(total)}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm text-foreground/60">ИНН АЗС *</label>
            <div className="mt-1 flex">
              <SuggestField
                value={inn}
                onChange={pickInn}
                allOptions={stations.map((s) => s.inn)}
                placeholder="10 или 12 цифр"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-foreground/60">Наименование АЗС *</label>
            <div className="mt-1 flex">
              <SuggestField
                value={stationName}
                onChange={pickName}
                allOptions={stations.map((s) => s.name)}
                placeholder="Например, ПАО «Лукойл», АЗС №123"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="fuel-file" className="text-sm text-foreground/60">
            Чек (PDF или фото) *
          </label>
          <input
            id="fuel-file"
            name="file"
            type="file"
            required
            accept=".pdf,image/*"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-foreground/20 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Сохраняем..." : "Добавить"}
        </button>
      </form>
    </Modal>
  );
}

export function FuelTable({
  receipts,
  vehicles,
  drivers,
  stations,
}: {
  receipts: FuelRow[];
  vehicles: VehicleOption[];
  drivers: string[];
  stations: StationOption[];
}) {
  const [creating, setCreating] = useState(false);

  const totals = useMemo(() => {
    const t = Object.fromEntries(FUEL_TYPES.map((f) => [f, { liters: 0, amount: 0 }])) as Record<
      FuelType,
      { liters: number; amount: number }
    >;
    for (const r of receipts) {
      t[r.fuelType].liters += r.liters;
      t[r.fuelType].amount += r.totalAmount;
    }
    return t;
  }, [receipts]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Добавить заправку"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </button>
        <h1 className="text-lg font-semibold">Заправки</h1>
      </div>

      {receipts.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Заправок пока нет.</p>
      ) : (
        <FitWidth className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-foreground/50">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Водитель</th>
                <th className="py-2 pr-4">Машина</th>
                <th className="py-2 pr-4">Гос.номер</th>
                {FUEL_TYPES.map((f) => (
                  <th key={f} className="py-2 pr-4 text-right">
                    {FUEL_LABELS[f]}
                  </th>
                ))}
                <th className="py-2 pr-4">АЗС</th>
                <th className="py-2 pr-4">Цена за 1 л</th>
                <th className="py-2 pr-4">НДС</th>
                <th className="py-2 pr-4">Чек</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-foreground/10">
                  <td className="whitespace-nowrap py-2 pr-4">{formatDate(r.date)}</td>
                  <td className="py-2 pr-4">{r.driverName}</td>
                  <td className="py-2 pr-4">
                    {r.vehicle.brand} {r.vehicle.model}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{r.vehicle.licensePlate}</td>
                  {FUEL_TYPES.map((f) => (
                    <td key={f} className="whitespace-nowrap py-2 pr-4 text-right">
                      {r.fuelType === f ? (
                        <>
                          <div>{formatLiters(r.liters)}</div>
                          <div className="font-medium">{formatRubPrecise(r.totalAmount)}</div>
                        </>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pr-4">
                    <div>{r.stationName}</div>
                    <div className="text-xs text-foreground/50">ИНН {r.stationInn}</div>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{formatRubPrecise(r.pricePerLiter)}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{vatLabel(r.vatRate)}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener"
                      title={r.fileName}
                      className="underline underline-offset-4 hover:opacity-80"
                    >
                      Открыть
                    </a>
                  </td>
                  <td className="py-2 text-right">
                    <DeleteButton
                      action={deleteFuelReceipt.bind(null, r.id)}
                      confirmText={`Удалить заправку от ${formatDate(r.date)} (${r.driverName})?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-4" colSpan={4}>
                  Итого
                </td>
                {FUEL_TYPES.map((f) => (
                  <td key={f} className="whitespace-nowrap py-2 pr-4 text-right">
                    <div className="font-normal">{formatLiters(totals[f].liters)}</div>
                    <div>{formatRubPrecise(totals[f].amount)}</div>
                  </td>
                ))}
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </FitWidth>
      )}

      {creating && (
        <NewFuelReceipt vehicles={vehicles} drivers={drivers} stations={stations} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
