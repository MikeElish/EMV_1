"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAdminPrice } from "@/lib/money";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { DocumentFileLink } from "@/components/admin/DocumentFileLink";
import { LogisticsRequestModal, type LogisticsSource } from "@/components/admin/LogisticsRequestModal";
import type { LogisticsRequestType, LogisticsRequestStatus } from "@prisma/client";

type LogisticsRequestListItem = {
  id: string;
  number: number;
  type: LogisticsRequestType;
  status: LogisticsRequestStatus;
  counterparty: { name: string } | null;
  executor: { lastName: string | null; firstName: string | null; login: string } | null;
  order: { orderNumber: string } | null;
  supplierPurchase: { number: number } | null;
  address: string | null;
  cost: number | null;
  executedAt: Date | null;
  fileUrl: string | null;
  fileName: string | null;
};

const TYPE_LABELS: Record<LogisticsRequestType, string> = { SEND: "Отправка", RECEIVE: "Получение" };
const STATUS_LABELS: Record<LogisticsRequestStatus, string> = {
  PENDING: "На рассмотрении",
  IN_PROGRESS: "На выполнении",
  COMPLETED: "Исполнено",
  CANCELLED: "Отменено",
};
const STATUS_STYLES: Record<LogisticsRequestStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-600/10 text-blue-700 dark:text-blue-400",
  COMPLETED: "bg-green-600/10 text-green-700 dark:text-green-500",
  CANCELLED: "bg-foreground/10 text-foreground/50",
};

export function LogisticsTable({ requests }: { requests: LogisticsRequestListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [
        String(r.number),
        TYPE_LABELS[r.type],
        STATUS_LABELS[r.status],
        r.counterparty?.name,
        r.executor ? [r.executor.lastName, r.executor.firstName].filter(Boolean).join(" ") || r.executor.login : "",
        r.order?.orderNumber,
        r.supplierPurchase?.number ? `ЗП-${r.supplierPurchase.number}` : "",
        r.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [requests, search]);

  const emptySource: LogisticsSource = { kind: "empty", lines: [] };

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Новая заявка"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </button>
        <h1 className="text-lg font-semibold">Логистика</h1>
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Заявок на логистику пока нет.</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">№ заявки</th>
                <th className="py-2 pr-4">Тип</th>
                <th className="py-2 pr-4">Контрагент</th>
                <th className="py-2 pr-4">Адрес</th>
                <th className="py-2 pr-4">Исполнитель</th>
                <th className="py-2 pr-4 text-right">Стоимость</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Дата исполнения</th>
                <th className="py-2 pr-4">Файл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-foreground/10">
                  <td className="whitespace-nowrap py-2 pr-4 font-medium">Л-{r.number}</td>
                  <td className="py-2 pr-4">{TYPE_LABELS[r.type]}</td>
                  <td className="py-2 pr-4">{r.counterparty?.name ?? "—"}</td>
                  <td className="py-2 pr-4">{r.address ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {r.executor ? [r.executor.lastName, r.executor.firstName].filter(Boolean).join(" ") || r.executor.login : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">{r.cost ? formatAdminPrice(r.cost) : "—"}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {r.executedAt ? new Date(r.executedAt).toLocaleDateString("ru-RU") : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {r.fileUrl ? (
                      <DocumentFileLink fileUrl={r.fileUrl} fileName={r.fileName ?? "Файл"} className="text-blue-600 hover:underline dark:text-blue-400" />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {creating && <LogisticsRequestModal source={emptySource} onClose={() => setCreating(false)} />}
    </>
  );
}
