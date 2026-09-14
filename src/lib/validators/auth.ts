import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Введите логин или email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const setupSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});
