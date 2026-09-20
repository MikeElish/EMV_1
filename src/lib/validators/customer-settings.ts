import { z } from "zod";

export const DELIVERY_METHOD_VALUES = ["ADDRESS", "TERMINAL", "PICKUP"] as const;

export const customerSettingsSchema = z
  .object({
    lastName: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    email: z.string().trim().email("Некорректный email"),
    currentPassword: z.string().optional(),
    newPassword: z.union([z.string().min(6, "Минимум 6 символов"), z.literal("")]).optional(),
    deliveryMethod: z.enum(DELIVERY_METHOD_VALUES).optional(),
    settlement: z.string().trim().optional(),
    street: z.string().trim().optional(),
    house: z.string().trim().optional(),
    apartment: z.string().trim().optional(),
    terminal: z.string().trim().optional(),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "Введите текущий пароль для смены пароля",
    path: ["currentPassword"],
  });

export type CustomerSettingsInput = z.infer<typeof customerSettingsSchema>;
