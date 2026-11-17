import { z } from "zod";

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Укажите название бренда").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Только латиница, цифры и дефис"),
  isActive: z.boolean().default(true),
});

export type BrandInput = z.infer<typeof brandSchema>;
