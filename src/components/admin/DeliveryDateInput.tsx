"use client";

function formatDay(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

function addDays(date: Date | string | null, days: number): string {
  if (!date) return "—";
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

/**
 * Read-only delivery dates for an order line.
 * - До склада: supplier promise (from the supplier order line).
 * - До клиента: supplier promise + delivery days when ADDRESS/TERMINAL,
 *   otherwise the same as До склада.
 */
export function DeliveryDateInput({
  supplierDate,
  deliveryDays,
  needsDelivery,
}: {
  supplierDate: Date | string | null;
  deliveryDays: number;
  needsDelivery: boolean;
}) {
  const toClient = needsDelivery ? addDays(supplierDate, deliveryDays) : formatDay(supplierDate);
  return (
    <div className="whitespace-nowrap text-xs leading-5">
      <div className="text-foreground/70">До склада — {formatDay(supplierDate)}</div>
      <div>До клиента — {toClient}</div>
    </div>
  );
}
