import "server-only";
import { prisma } from "@/lib/prisma";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";

// Отчёты → Бонусы of an employee for a period:
//  - income: the lines of the orders they manage (Order.managerId) that are
//    paid and shipped (handed over / passed to a transport company), by the
//    order's handover date;
//  - cost of sales: the purchase price of those lines (the supplier order's
//    price, else the offer's, else the product's purchase price);
//  - costs: Доп.расходы charged to them (ExtraCost.employeeId), not cancelled;
//  - К выплате: their «% от прибыли» of (sales − cost of sales − costs).

export type SalaryRow = { key: string; date: string; document: string; href: string | null; income: number; costs: number; total: number; note?: string };

export type SalaryReport = {
  sales: number;
  costOfSales: number;
  costs: number;
  profit: number;
  percent: number | null;
  /** The plan of the Оклад for the period (Финансы → Зарплата): 2.25 × Оклад a month. */
  plan: number;
  /** The bonus: % of the profit above the plan. */
  payout: number;
  rows: SalaryRow[];
};

const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const ru = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export async function salaryReport(employeeId: string, from: string, to: string): Promise<SalaryReport> {
  const start = new Date(`${from}T00:00:00+03:00`);
  const end = new Date(`${to}T23:59:59.999+03:00`);
  const [employee, orders, extra] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId }, select: { salaryPercent: true, salary: true } }),
    prisma.order.findMany({
      where: {
        managerId: employeeId,
        OR: [{ handoverAt: { gte: start, lte: end } }, { handoverAt: null, shippedAt: { gte: start, lte: end } }, { handoverAt: null, shippedAt: null, updatedAt: { gte: start, lte: end } }],
        items: { some: { paid: true, status: { in: SHIPPED_STATUSES } } },
      },
      select: {
        orderNumber: true,
        customerName: true,
        handoverAt: true,
        shippedAt: true,
        updatedAt: true,
        user: { select: { company: { select: { name: true } } } },
        items: {
          where: { paid: true, status: { in: SHIPPED_STATUSES } },
          select: {
            priceSnapshot: true,
            quantity: true,
            supplierOrderLines: { where: { price: { gt: 0 } }, select: { price: true }, orderBy: { createdAt: "desc" }, take: 1 },
            offer: { select: { price: true } },
            product: { select: { offers: { where: { selected: true }, select: { price: true } }, pricing: { select: { purchasePrice: true } } } },
          },
        },
      },
    }),
    prisma.extraCost.findMany({
      where: { employeeId, status: { not: "Отменено" }, date: { gte: start, lte: end } },
      select: { id: true, kind: true, number: true, date: true, amount: true, supplier: { select: { name: true } }, order: { select: { orderNumber: true } } },
    }),
  ]);

  const rows: SalaryRow[] = [];
  let sales = 0;
  let costOfSales = 0;
  for (const o of orders) {
    let sale = 0;
    let cost = 0;
    let unknown = 0;
    for (const i of o.items) {
      sale += i.priceSnapshot * i.quantity;
      const purchase = i.supplierOrderLines[0]?.price || i.offer?.price || i.product.offers[0]?.price || i.product.pricing?.purchasePrice || 0;
      if (!purchase) unknown++;
      cost += purchase * i.quantity;
    }
    sales += sale;
    costOfSales += cost;
    const date = day(o.handoverAt ?? o.shippedAt ?? o.updatedAt);
    rows.push({
      key: `o-${o.orderNumber}`,
      date,
      document: `Заказ № ${o.orderNumber} от ${ru(date)} — ${o.user?.company?.name ?? o.customerName}`,
      href: `/admin/crm/orders?orderNumber=${encodeURIComponent(o.orderNumber)}`,
      income: sale - cost,
      costs: 0,
      total: sale - cost,
      ...(unknown ? { note: `нет закупочной цены у ${unknown} поз. — себестоимость занижена` } : {}),
    });
  }
  let costs = 0;
  for (const c of extra) {
    costs += c.amount;
    const date = day(c.date);
    rows.push({
      key: `c-${c.id}`,
      date,
      document: [`${c.kind}${c.number ? ` № ${c.number}` : ""} от ${ru(date)}`, c.supplier?.name, c.order && `заказ ${c.order.orderNumber}`].filter(Boolean).join(" — "),
      href: "/admin/crm/extra-costs",
      income: 0,
      costs: c.amount,
      total: -c.amount,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const profit = sales - costOfSales - costs;
  const percent = employee?.salaryPercent ?? null;
  // The plan of each month the period touches (a part of a month counts in full).
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  const plan = Math.round((employee?.salary ?? 0) * 2.25 * months);
  const payout = percent === null ? 0 : Math.max(0, Math.round(((profit - plan) * percent) / 100));
  return { sales, costOfSales, costs, profit, percent, plan, payout, rows };
}
