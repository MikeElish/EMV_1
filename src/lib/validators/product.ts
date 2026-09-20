import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().trim().min(1, "Укажите артикул").max(64),
  name: z.string().trim().min(2, "Минимум 2 символа").max(200),
  slug: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Только латиница, цифры и дефис"),
  description: z.string().trim().max(2000).optional(),
  price: z.number().int().min(0, "Цена не может быть отрицательной"),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1, "Выберите категорию"),
  brand: z.string().trim().max(80).optional(),
  machineType: z.string().trim().max(80).optional(),
  compatibleWith: z.array(z.string().trim().min(1)).default([]),
  images: z.array(z.string().trim().url()).default([]),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
