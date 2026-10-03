import { prisma } from "@/lib/prisma";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { CompaniesTable, type CompanyBalance } from "@/components/admin/CompaniesTable";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";

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
        items: { select: { status: true, priceSnapshot: true, quantity: true } },
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
    // Lines ship one by one, so only the shipped ones count.
    const shippedAmount = order.items
      .filter((i) => SHIPPED_STATUSES.includes(i.status))
      .reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);

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
    <CrmPage>
      <CompaniesTable companies={companies} managers={managers} balances={balances} />
    </CrmPage>
  );
}
