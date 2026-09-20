import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteCategory } from "@/actions/admin/categories";
import { DeleteButton } from "@/components/admin/DeleteButton";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Категории</h1>
        <Link
          href="/admin/crm/categories/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Добавить категорию
        </Link>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2">Название</th>
            <th className="py-2">Slug</th>
            <th className="py-2">Товаров</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-b border-foreground/10">
              <td className="py-2">{category.name}</td>
              <td className="py-2 text-foreground/50">{category.slug}</td>
              <td className="py-2">{category._count.products}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-4">
                  <Link
                    href={`/admin/crm/categories/${category.id}/edit`}
                    className="hover:underline"
                  >
                    Изменить
                  </Link>
                  <DeleteButton
                    action={deleteCategory.bind(null, category.id)}
                    confirmText={`Удалить категорию «${category.name}»?`}
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
