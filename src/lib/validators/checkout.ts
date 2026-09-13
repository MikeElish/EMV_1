import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Укажите имя").max(120),
  customerPhone: z.string().trim().min(5, "Укажите телефон").max(30),
  customerEmail: z.string().trim().email("Укажите корректный e-mail"),
  deliveryNote: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, "Корзина пуста"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
