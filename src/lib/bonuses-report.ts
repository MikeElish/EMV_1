import "server-only";

import { prisma } from "@/lib/prisma";
import { orderLineTotal } from "@/lib/order-pricing";

const periodStart = (from: string) => new Date(`${from}T00:00:00.000+03:00`);
const periodEnd = (to: string) => new Date(`${to}T23:59:59.999+03:00`);
const isoDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const displayDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export type BonusReportOrder = {
  orderNumber: string;
  status: string;
  deliveryDate: string;
  paymentStatus: string;
};

export type BonusReportRow = {
  key: string;
  companyId: string;
  company: string;
  managerId: string | null;
  manager: string;
  income: number;
  sales: number;
  cost: number;
  margin: number;
  bonus: number;
  bonusOverride: number | null;
  issued: number;
  requestNumber: number | null;
  requestStatus: string | null;
  unknownCostLines: number;
  orders: BonusReportOrder[];
};

export async function bonusesReport(from: string, to: string): Promise<BonusReportRow[]> {
  const start = periodStart(from);
  const end = periodEnd(to);
  const [orders, settlements] = await Promise.all([
    prisma.order.findMany({
      where: {
        invoiceDate: { gte: start, lte: end },
        items: {
          some: {
            paid: true,
            cancelled: false,
            status: { not: "CANCELLED" },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        orderNumber: true,
        status: true,
        invoiceDate: true,
        managerId: true,
        manager: { select: { lastName: true, firstName: true, patronymic: true, login: true } },
        buyerCompany: { select: { id: true, name: true } },
        user: { select: { company: { select: { id: true, name: true } } } },
        bankTransactions: {
          where: { incoming: true, date: { gte: start, lte: end } },
          select: { amount: true },
        },
        items: {
          select: {
            cancelled: true,
            status: true,
            priceSnapshot: true,
            quantity: true,
            bonus: true,
            paid: true,
            deferred: true,
            deliveryDate: true,
            supplierOrderLines: {
              where: { price: { gt: 0 } },
              select: { price: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            offer: { select: { price: true } },
            product: {
              select: {
                offers: { where: { selected: true }, select: { price: true }, take: 1 },
                pricing: { select: { purchasePrice: true } },
              },
            },
          },
        },
      },
    }),
    prisma.bonusSettlement.findMany({
      where: { periodFrom: start, periodTo: end },
      include: { paymentRequest: { select: { number: true, amount: true, status: true } } },
    }),
  ]);

  const settlementByKey = new Map(
    settlements.map((settlement) => [`${settlement.companyId}:${settlement.managerId}`, settlement])
  );
  const grouped = new Map<string, BonusReportRow>();

  for (const order of orders) {
    const company = order.buyerCompany ?? order.user?.company;
    if (!company) continue;
    const key = `${company.id}:${order.managerId ?? ""}`;
    let row = grouped.get(key);
    if (!row) {
      const settlement = settlementByKey.get(`${company.id}:${order.managerId ?? ""}`);
      const managerName = order.manager
        ? [order.manager.lastName, order.manager.firstName, order.manager.patronymic].filter(Boolean).join(" ") || order.manager.login
        : "Не назначен";
      row = {
        key,
        companyId: company.id,
        company: company.name,
        managerId: order.managerId,
        manager: managerName,
        income: 0,
        sales: 0,
        cost: 0,
        margin: 0,
        bonus: 0,
        bonusOverride: settlement?.bonusOverride ?? null,
        issued: settlement?.paymentRequest?.status === "Оплачено" ? settlement.paymentRequest.amount : 0,
        requestNumber: settlement?.paymentRequest?.number ?? null,
        requestStatus: settlement?.paymentRequest?.status ?? null,
        unknownCostLines: 0,
        orders: [],
      };
      grouped.set(key, row);
    }

    row.income += order.bankTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const deliveryDates: string[] = [];
    const periodItems = order.items.filter(
      (item) => item.paid && !item.cancelled && item.status !== "CANCELLED"
    );
    for (const item of periodItems) {
      row.sales += orderLineTotal(item);
      const purchase =
        item.supplierOrderLines[0]?.price ||
        item.offer?.price ||
        item.product.offers[0]?.price ||
        item.product.pricing?.purchasePrice ||
        0;
      if (purchase <= 0) row.unknownCostLines++;
      row.cost += purchase * item.quantity;
      if (item.deliveryDate) deliveryDates.push(isoDay(item.deliveryDate));
    }
    const orderedDates = [...new Set(deliveryDates)].sort();
    const deliveryDate = !orderedDates.length
      ? "—"
      : orderedDates.length === 1
        ? displayDay(orderedDates[0])
        : `${displayDay(orderedDates[0])} — ${displayDay(orderedDates[orderedDates.length - 1])}`;
    const activeItems = order.items.filter((item) => item.status !== "CANCELLED");
    const paidCount = activeItems.filter((item) => item.paid).length;
    const deferredCount = activeItems.filter((item) => item.deferred && !item.paid).length;
    const paymentStatus =
      activeItems.length > 0 && paidCount === activeItems.length
        ? "Оплачено"
        : paidCount > 0
          ? "Частично оплачено"
          : activeItems.length > 0 && deferredCount === activeItems.length
            ? "Отсрочка"
            : "Не оплачено";
    row.orders.push({ orderNumber: order.orderNumber, status: order.status, deliveryDate, paymentStatus });
  }

  for (const row of grouped.values()) {
    row.margin = row.sales - row.cost;
    row.bonus = row.bonusOverride ?? Math.round(row.margin * 0.5);
  }
  return [...grouped.values()].sort((a, b) => a.company.localeCompare(b.company, "ru") || a.manager.localeCompare(b.manager, "ru"));
}

export function bonusPeriodDates(from: string, to: string) {
  return { periodFrom: periodStart(from), periodTo: periodEnd(to) };
}
