"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { createBonusPaymentRequest, saveBonusOverride } from "@/actions/admin/bonuses";
import { Modal } from "@/components/Modal";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import type { Period } from "@/lib/period";
import type { BonusReportRow } from "@/lib/bonuses-report";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";

function BonusAmountCell({
  row,
  period,
  editable,
}: {
  row: BonusReportRow;
  period: Period;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(row.bonus / 100).replace(".", ","));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = !editable || !row.managerId || row.requestNumber !== null;

  function save() {
    const rubles = parseFloat(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(rubles) || rubles < 0) return setError("Укажите сумму от нуля");
    startTransition(async () => {
      const result = await saveBonusOverride(
        row.companyId,
        row.managerId!,
        period.from,
        period.to,
        rublesToKopecksRoundedUp(rubles)
      );
      if (!result.ok) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  function reset() {
    if (!row.managerId) return;
    startTransition(async () => {
      const result = await saveBonusOverride(row.companyId, row.managerId!, period.from, period.to, null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (!editable) return <span>{formatRub(row.bonus)}</span>;
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-end gap-1">
        <input
          aria-label={`Бонус компании ${row.company}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()}
          disabled={locked || pending}
          inputMode="decimal"
          className="w-28 rounded border border-foreground/20 bg-transparent px-2 py-1 text-right text-sm disabled:opacity-50"
        />
        <button type="button" onClick={save} disabled={locked || pending} className="rounded border border-foreground/20 px-2 py-1 text-xs disabled:opacity-40">
          OK
        </button>
      </div>
      {row.bonusOverride !== null && <span className="text-[11px] text-foreground/50">изменён вручную · <button type="button" disabled={locked || pending} onClick={reset} className="underline disabled:opacity-50">по формуле</button></span>}
      {row.bonusOverride === null && <span className="text-[11px] text-foreground/50">50% от наценки</span>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function BonusRequestAction({ row, period }: { row: BonusReportRow; period: Period }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (row.requestNumber !== null) {
    const label = row.requestStatus === "Оплачено" ? "Выплачено" : row.requestStatus === "Отменено" ? "Заявка отменена" : "Заявка";
    return (
      <Link href="/admin/finance/payment-requests" onClick={(event) => event.stopPropagation()} className="whitespace-nowrap text-blue-600 hover:underline dark:text-blue-400">
        {label} № {row.requestNumber}
      </Link>
    );
  }
  if (!row.managerId) return <span className="text-xs text-foreground/40">Не назначен менеджер</span>;
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        disabled={pending || row.bonus <= 0}
        onClick={() =>
          startTransition(async () => {
            const result = await createBonusPaymentRequest(row.companyId, row.managerId!, period.from, period.to);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
        className="whitespace-nowrap rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-40"
      >
        {pending ? "Формируем…" : "Заявка на оплату"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function BonusesReportView({
  period,
  rows,
  canEditBonus,
}: {
  period: Period;
  rows: BonusReportRow[];
  canEditBonus: boolean;
}) {
  const [selected, setSelected] = useState<BonusReportRow | null>(null);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Бонусы · {period.label}</h1>
        <PeriodPicker period={period} path="/admin/finance/bonuses" />
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        В начисление входят только оплаченные покупателем позиции по счетам выбранного периода. Бонус по умолчанию равен 50% наценки.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
              <th className="py-2 pr-3 font-normal">Компания</th>
              <th className="py-2 pr-3 text-right font-normal">Поступления</th>
              <th className="py-2 pr-3 text-right font-normal">Продажи</th>
              <th className="py-2 pr-3 text-right font-normal">Себестоимость</th>
              <th className="py-2 pr-3 text-right font-normal">Наценка</th>
              <th className="py-2 pr-3 text-right font-normal">Бонус</th>
              <th className="py-2 pr-3 text-right font-normal">Выдано</th>
              <th className="py-2 font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-foreground/40">За период нет оплаченных покупателем позиций по выставленным счетам.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.key} onClick={() => setSelected(row)} className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5">
                <td className="py-2 pr-3">
                  <span className="font-medium">{row.company}</span>
                  <span className="block text-xs text-foreground/50">{row.manager}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">{formatRub(row.income)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">{formatRub(row.sales)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">
                  {formatRub(row.cost)}
                  {row.unknownCostLines > 0 && <span className="ml-1 text-xs text-amber-600" title={`Нет закупочной цены у ${row.unknownCostLines} поз.`}>*</span>}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">{formatRub(row.margin)}</td>
                <td className="py-2 pr-3 text-right"><BonusAmountCell key={`${row.key}:${period.from}:${period.to}:${row.bonus}`} row={row} period={period} editable={canEditBonus} /></td>
                <td className="whitespace-nowrap py-2 pr-3 text-right">{formatRub(row.issued)}</td>
                <td className="py-2"><BonusRequestAction row={row} period={period} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.unknownCostLines > 0) && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">* Себестоимость занижена: для части позиций не найдена закупочная цена.</p>
      )}
      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-3xl" title={`${selected.company} · заказы`}>
          <h2 className="text-lg font-semibold">{selected.company}</h2>
          <p className="mt-1 text-sm text-foreground/50">Менеджер: {selected.manager}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
                  <th className="py-2 pr-3 font-normal">Заказ</th>
                  <th className="py-2 pr-3 font-normal">Статус</th>
                  <th className="py-2 pr-3 font-normal">Дата поставки</th>
                  <th className="py-2 font-normal">Статус оплаты</th>
                </tr>
              </thead>
              <tbody>
                {selected.orders.map((order) => (
                  <tr key={order.orderNumber} className="border-b border-foreground/10">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/crm/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`} className="underline underline-offset-2" onClick={() => setSelected(null)}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}</td>
                    <td className="py-2 pr-3">{order.deliveryDate}</td>
                    <td className="py-2">{order.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
