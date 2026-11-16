"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { saveLogisticsRequest, uploadLogisticsFile, getLogisticsFormData, type LogisticsFormData, type LogisticsRequestInput } from "@/actions/admin/logistics";
import { formatAdminPrice, rublesToKopecksRoundedUp } from "@/lib/money";
import type { LogisticsRequestType, LogisticsRequestStatus } from "@prisma/client";

export type LogisticsSource =
  | { kind: "order"; orderId: string; counterpartyId: string | null; address: string | null; documentKind: "UPD"; lines: LogisticsLine[] }
  | { kind: "supplierPurchase"; purchaseId: string; counterpartyId: string | null; address: string | null; documentKind: "INVOICE"; lines: LogisticsLine[] }
  | { kind: "empty"; lines: LogisticsLine[] };

export type LogisticsLine = {
  productId: string;
  brand: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
};

const TYPE_LABELS: Record<LogisticsRequestType, string> = { SEND: "Отправка", RECEIVE: "Получение" };
const STATUS_LABELS: Record<LogisticsRequestStatus, string> = {
  PENDING: "На рассмотрении",
  IN_PROGRESS: "На выполнении",
  COMPLETED: "Исполнено",
  CANCELLED: "Отменено",
};

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

function formatDateInput(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function LogisticsRequestModal({
  source,
  onClose,
}: {
  source: LogisticsSource;
  onClose: () => void;
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<LogisticsFormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getLogisticsFormData()
      .then((r) => {
        if (!active) return;
        if (r.ok) {
          setFormData({ companies: r.companies, employees: r.employees, orders: r.orders, purchases: r.purchases });
        } else {
          setLoadError(r.error);
        }
      })
      .catch(() => setLoadError("Не удалось загрузить справочники"));
    return () => {
      active = false;
    };
  }, []);

  const initialState = useMemo(() => {
    const isOrder = source.kind === "order";
    const isPurchase = source.kind === "supplierPurchase";
    return {
      type: (isOrder ? "SEND" : isPurchase ? "RECEIVE" : "SEND") as LogisticsRequestType,
      counterpartyId: isOrder || isPurchase ? source.counterpartyId ?? null : null,
      address: isOrder || isPurchase ? source.address ?? "" : "",
      documentKind: isOrder || isPurchase ? source.documentKind ?? null : null,
    };
  }, [source]);

  const [type, setType] = useState<LogisticsRequestType>(initialState.type);
  const [status, setStatus] = useState<LogisticsRequestStatus>("PENDING");
  const [counterpartyId, setCounterpartyId] = useState<string | null>(initialState.counterpartyId);
  const [address, setAddress] = useState(initialState.address);
  const [documentKind, setDocumentKind] = useState<string | null>(initialState.documentKind);
  const [cost, setCost] = useState<string>("");
  const [executorId, setExecutorId] = useState<string | null>(null);
  const [executedAt, setExecutedAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<(LogisticsLine & { selected: boolean })[]>(
    source.lines.map((l) => ({ ...l, selected: true }))
  );

  const employeeOptions = useMemo(
    () =>
      formData?.employees.map((e) => ({
        value: e.id,
        label: [e.lastName, e.firstName].filter(Boolean).join(" ") || e.login,
      })) ?? [],
    [formData]
  );

  const total = lines.filter((l) => l.selected).reduce((sum, l) => sum + l.quantity * l.price, 0);

  function toggleAll(selected: boolean) {
    setLines((prev) => prev.map((l) => ({ ...l, selected })));
  }

  function toggleLine(productId: string, selected: boolean) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, selected } : l)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input: LogisticsRequestInput = {
      type,
      status,
      counterpartyId,
      address: address.trim() || null,
      documentKind,
      cost: cost.trim() ? rublesToKopecksRoundedUp(Number(cost.replace(",", "."))) : null,
      executorId,
      executedAt: executedAt || null,
      lines: lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        brand: l.brand,
        sku: l.sku,
        quantity: l.quantity,
        price: l.price,
        selected: l.selected,
      })),
    };
    if (source.kind === "order") input.orderId = source.orderId;
    if (source.kind === "supplierPurchase") input.supplierPurchaseId = source.purchaseId;

    startTransition(async () => {
      const result = await saveLogisticsRequest(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (file && result.id) {
        const body = new FormData();
        body.set("file", file);
        await uploadLogisticsFile(result.id, body);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-5xl">
      <h2 className="text-lg font-semibold">Заявка на внутреннюю логистику</h2>
      {!formData ? (
        <p className={`mt-6 text-sm ${loadError ? "text-red-600" : "text-foreground/40"}`}>{loadError ?? "Загрузка..."}</p>
      ) : (
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-sm text-foreground/60">Тип</label>
            <SearchSelect
              value={type}
              onChange={(v) => setType(v as LogisticsRequestType)}
              options={[
                { value: "SEND", label: TYPE_LABELS.SEND },
                { value: "RECEIVE", label: TYPE_LABELS.RECEIVE },
              ]}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Статус</label>
            <SearchSelect
              value={status}
              onChange={(v) => setStatus(v as LogisticsRequestStatus)}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Стоимость, ₽</label>
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="decimal"
              className={`${inputClassName} mt-1`}
            />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Дата исполнения</label>
            <input
              type="date"
              value={executedAt}
              onChange={(e) => setExecutedAt(e.target.value)}
              className={`${inputClassName} mt-1`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-foreground/60">Контрагент</label>
            <SearchSelect
              value={counterpartyId ?? ""}
              onChange={(v) => setCounterpartyId(v || null)}
              emptyLabel="— не выбран —"
              options={formData?.companies.map((c) => ({ value: c.id, label: c.name })) ?? []}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-foreground/60">Исполнитель</label>
            <SearchSelect
              value={executorId ?? ""}
              onChange={(v) => setExecutorId(v || null)}
              emptyLabel="— не выбран —"
              options={employeeOptions}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-foreground/60">Адрес</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={`${inputClassName} mt-1`} />
        </div>

        <div>
          <label className="text-sm text-foreground/60">Файл ({documentKind === "UPD" ? "УПД" : documentKind === "INVOICE" ? "Счёт" : "документ"})</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
        </div>

        <div>
          <h3 className="text-sm font-medium">Позиции</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-foreground/50">
              <tr>
                <th className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={lines.length > 0 && lines.every((l) => l.selected)}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="py-2 pr-4">№ п/п</th>
                <th className="py-2 pr-4">Бренд</th>
                <th className="py-2 pr-4">Наименование</th>
                <th className="py-2 pr-4">Артикул</th>
                <th className="py-2 pr-4">Количество</th>
                <th className="py-2 pr-4">Цена</th>
                <th className="py-2 text-right">Всего</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.productId} className="border-b border-foreground/10">
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={line.selected} onChange={(e) => toggleLine(line.productId, e.target.checked)} />
                  </td>
                  <td className="py-2 pr-4">{index + 1}</td>
                  <td className="py-2 pr-4">{line.brand ?? "—"}</td>
                  <td className="py-2 pr-4">{line.name}</td>
                  <td className="py-2 pr-4">{line.sku ?? "—"}</td>
                  <td className="py-2 pr-4">{line.quantity}</td>
                  <td className="py-2 pr-4">{formatAdminPrice(line.price)}</td>
                  <td className="py-2 text-right">{formatAdminPrice(line.quantity * line.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm">Итого по выбранным: <strong>{formatAdminPrice(total)}</strong></p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
            Отмена
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "Сохраняем..." : "Отправить"}
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
}
