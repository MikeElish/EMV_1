import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const setupSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});
