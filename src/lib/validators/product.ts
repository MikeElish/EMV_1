import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().trim().min(1, "Укажите артикул").max(64),
  name: z.string().trim().min(2, "Минимум 2 символа").max(200),
  description: z.string().trim().max(2000).optional(),
  // Wholesale price -- the one shown on the site.
  price: z.number().int().min(0, "Цена не может быть отрицательной"),
  purchasePrice: z.number().int().min(0, "Цена не может быть отрицательной"),
  retailPrice: z.number().int().min(0, "Цена не может быть отрицательной"),
  dealerPrice: z.number().int().min(0, "Цена не может быть отрицательной"),
  supplierId: z.string().trim().optional(),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1, "Выберите категорию"),
  brand: z.string().trim().max(80).optional(),
  machineType: z.string().trim().max(80).optional(),
  compatibleWith: z.array(z.string().trim().min(1)).default([]),
  images: z.array(z.string().trim().url()).default([]),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
