import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/money";
import { deleteProduct } from "@/actions/admin/products";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ActiveToggle } from "@/components/admin/ActiveToggle";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Товары</h1>
        <div className="flex gap-3">
          <Link
            href="/admin/crm/products/import"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Импорт CSV/Excel
          </Link>
          <Link
            href="/admin/crm/products/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Добавить товар
          </Link>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2">Товар</th>
            <th className="py-2">Категория</th>
            <th className="py-2">Группа</th>
            <th className="py-2">Цена</th>
            <th className="py-2">Остаток</th>
            <th className="py-2">Активен</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-foreground/10">
              <td className="py-2">
                <div>{product.name}</div>
                <div className="text-xs text-foreground/40">{product.sku}</div>
              </td>
              <td className="py-2 text-foreground/60">{product.category.name}</td>
              <td className="py-2 text-foreground/60">{product.group ?? "—"}</td>
              <td className="py-2">{formatRub(product.price)}</td>
              <td className="py-2">{product.stock}</td>
              <td className="py-2">
                <ActiveToggle productId={product.id} isActive={product.isActive} />
              </td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-4">
                  <Link
                    href={`/admin/crm/products/${product.id}/edit`}
                    className="hover:underline"
                  >
                    Изменить
                  </Link>
                  <DeleteButton
                    action={deleteProduct.bind(null, product.id)}
                    confirmText={`Удалить товар «${product.name}»?`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
