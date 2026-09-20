import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCategory } from "@/actions/admin/categories";
import { CategoryForm } from "@/components/admin/CategoryForm";

export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/crm/categories/[id]/edit">) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Изменить категорию</h1>
      <CategoryForm
        initial={{ name: category.name, slug: category.slug }}
        onSubmit={(input) => updateCategory(id, input)}
      />
    </div>
  );
}
