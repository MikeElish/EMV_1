import { prisma } from "@/lib/prisma";
import { CompaniesTable, type CompanyBalance } from "@/components/admin/CompaniesTable";
import type { OrderStatus } from "@prisma/client";

const SHIPPED_STATUSES: OrderStatus[] = ["SHIPPED_AWAITING_PAYMENT", "DONE"];

export default async function CrmCompaniesPage() {
  const [companies, managers, orders] = await Promise.all([
    prisma.company.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      select: { id: true, lastName: true, firstName: true, login: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { user: { companyId: { not: null } } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        shippedAt: true,
        paid: true,
        totalAmount: true,
        user: { select: { companyId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const balances: Record<string, CompanyBalance> = {};
  for (const order of orders) {
    const companyId = order.user?.companyId;
    if (!companyId) continue;

    const paidAmount = order.paid ? order.totalAmount : 0;
    const shippedAmount = SHIPPED_STATUSES.includes(order.status) ? order.totalAmount : 0;

    const entry = balances[companyId] ?? { balance: 0, orders: [] };
    entry.balance += paidAmount - shippedAmount;
    entry.orders.push({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      shippedAt: order.shippedAt,
      paidAmount,
      shippedAmount,
    });
    balances[companyId] = entry;
  }

  return (
    <div className="overflow-x-auto">
      <CompaniesTable companies={companies} managers={managers} balances={balances} />
    </div>
  );
}
