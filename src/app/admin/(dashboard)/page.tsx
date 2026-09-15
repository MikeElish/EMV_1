import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [
    newOrders,
    totalProducts,
    lowStockProducts,
    totalCategories,
    newDriverApplications,
  ] = await Promise.all([
    prisma.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: 2 } },
      orderBy: { stock: "asc" },
      take: 5,
    }),
    prisma.category.count(),
    prisma.driverApplication.count({ where: { status: "NEW" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Дашборд</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Link
          href="/admin/crm/orders"
          className="rounded-lg border border-foreground/10 p-4 transition-colors hover:border-foreground/30"
        >
          <p className="text-sm text-foreground/50">Новые заказы</p>
          <p className="mt-1 text-3xl font-bold">{newOrders}</p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-lg border border-foreground/10 p-4 transition-colors hover:border-foreground/30"
        >
          <p className="text-sm text-foreground/50">Активных товаров</p>
          <p className="mt-1 text-3xl font-bold">{totalProducts}</p>
        </Link>
        <Link
          href="/admin/categories"
          className="rounded-lg border border-foreground/10 p-4 transition-colors hover:border-foreground/30"
        >
          <p className="text-sm text-foreground/50">Категорий</p>
          <p className="mt-1 text-3xl font-bold">{totalCategories}</p>
        </Link>
        <Link
          href="/admin/driver-applications"
          className="rounded-lg border border-foreground/10 p-4 transition-colors hover:border-foreground/30"
        >
          <p className="text-sm text-foreground/50">Новые заявки водителей</p>
          <p className="mt-1 text-3xl font-bold">{newDriverApplications}</p>
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Заканчивается на складе</h2>
        {lowStockProducts.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/50">
            Нет товаров с низким остатком.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {lowStockProducts.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  className="hover:underline"
                >
                  {product.name}
                </Link>
                <span className="text-foreground/50">
                  Остаток: {product.stock}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
