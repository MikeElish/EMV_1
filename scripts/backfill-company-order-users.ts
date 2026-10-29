import { prisma } from "../src/lib/prisma";

async function main() {
  // Orders created manually for a company have userId = null. Tie them to the
  // company's first customer account so they show up under «Мои заказы» and
  // in the company balance.
  const orders = await prisma.order.findMany({
    where: { userId: null },
    select: { id: true, orderNumber: true, customerName: true },
  });
  console.log("Orders without user:", orders.length);

  let updated = 0;
  for (const o of orders) {
    const company = await prisma.company.findFirst({ where: { name: o.customerName }, select: { id: true } });
    if (!company) continue;
    const user = await prisma.user.findFirst({
      where: { companyId: company.id, role: "CUSTOMER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!user) continue;
    await prisma.order.update({ where: { id: o.id }, data: { userId: user.id } });
    updated++;
    console.log(`#${o.orderNumber} -> user ${user.id} (company ${company.id})`);
  }
  console.log("Updated:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
