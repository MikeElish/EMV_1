import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Только латиница, цифры и дефис"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
