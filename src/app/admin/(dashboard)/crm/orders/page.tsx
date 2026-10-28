import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default async function CrmOrdersPage({
  searchParams,
}: PageProps<"/admin/crm/orders">) {
  const query = await searchParams;
  const orderNumber = typeof query.orderNumber === "string" ? query.orderNumber : undefined;

  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: { product: { select: { sku: true, stock: true } } },
        orderBy: { id: "asc" },
      },
      extraCosts: {
        select: { id: true, number: true, date: true, amount: true, kind: true, service: { select: { name: true } } },
        where: { status: { not: "Отменено" } },
        orderBy: { date: "asc" },
      },
      user: {
        select: {
          lastName: true,
          firstName: true,
          patronymic: true,
          login: true,
          company: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const me = await getMyAccess();
  const staff = await prisma.user.findMany({
    where: { role: { notIn: ["CUSTOMER", "DRIVER"] } },
    select: { id: true, lastName: true, firstName: true, login: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const employees = staff.map((u) => ({ id: u.id, name: [u.lastName, u.firstName].filter(Boolean).join(" ") || u.login }));

  return (
    <CrmPage>
      <OrdersTable orders={orders} initialOrderNumber={orderNumber} canDelete={me?.role === "OWNER"} employees={employees} />
    </CrmPage>
  );
}
