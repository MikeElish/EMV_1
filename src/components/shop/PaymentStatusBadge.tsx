import { getPaymentDisplayStatus } from "@/lib/validators/payment-status";

export function PaymentStatusBadge({
  paid,
  plannedPaymentDate,
}: {
  paid: boolean;
  plannedPaymentDate: Date | null;
}) {
  const status = getPaymentDisplayStatus({ paid, plannedPaymentDate });

  if (status.kind === "paid") {
    return <span className="text-green-600 dark:text-green-500">Оплачено</span>;
  }

  if (status.kind === "unpaid") {
    return <span className="text-red-600 dark:text-red-500">Не оплачено</span>;
  }

  const colorClass = status.graceActive
    ? "text-blue-600 dark:text-blue-500"
    : "text-red-600 dark:text-red-500";
  const note = status.graceActive ? "Отсрочка платежа" : "Пропущен платёж!";

  return (
    <div>
      <span className={`animate-pulse font-medium ${colorClass}`}>
        План оплаты {status.date.toLocaleDateString("ru-RU")}
      </span>
      <div className="text-xs text-foreground/50">{note}</div>
    </div>
  );
}
