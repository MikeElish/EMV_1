import { createCategory } from "@/actions/admin/categories";
import { CategoryForm } from "@/components/admin/CategoryForm";

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Новая категория</h1>
      <CategoryForm onSubmit={createCategory} />
    </div>
  );
}
