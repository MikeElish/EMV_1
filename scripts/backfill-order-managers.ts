import { prisma } from "../src/lib/prisma";

async function main() {
  // Default responsible owner: the first site owner (role OWNER), else first admin.
  const fallback = await prisma.user.findFirst({
    where: { role: { in: ["OWNER", "ADMIN", "CHIEF_MANAGER", "SENIOR_MANAGER", "MANAGER"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, login: true, role: true },
  });
  if (!fallback) {
    console.error("No employee found to use as fallback manager.");
    process.exit(1);
  }
  console.log("Fallback manager:", fallback.login, fallback.role, fallback.id);

  const orders = await prisma.order.findMany({
    where: { managerId: null },
    select: {
      id: true,
      orderNumber: true,
      user: { select: { company: { select: { managerId: true } } } },
    },
  });
  console.log("Orders without manager:", orders.length);

  let fromCompany = 0;
  let fromFallback = 0;
  for (const o of orders) {
    const managerId = o.user?.company?.managerId ?? fallback.id;
    if (o.user?.company?.managerId) fromCompany++;
    else fromFallback++;
    await prisma.order.update({ where: { id: o.id }, data: { managerId } });
  }
  console.log(`Updated: ${fromCompany} from company manager, ${fromFallback} from fallback.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
