import { createBrand } from "@/actions/admin/brands";
import { BrandForm } from "@/components/admin/BrandForm";

export default function NewBrandPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Новый бренд</h1>
      <BrandForm onSubmit={createBrand} />
    </div>
  );
}
