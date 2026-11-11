"use client";

import { useState, type ComponentProps } from "react";
import { ProductBackButton } from "@/components/admin/ProductBackButton";
import { ProductForm } from "@/components/admin/ProductForm";

type Props = Omit<ComponentProps<typeof ProductForm>, "onChanges">;

export function NewProductForm(props: Props) {
  const [hasChanges, setHasChanges] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Новый товар</h1>
        <ProductBackButton hasChanges={hasChanges} />
      </div>
      <ProductForm {...props} onChanges={setHasChanges} />
    </div>
  );
}
