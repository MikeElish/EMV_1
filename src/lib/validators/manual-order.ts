import { z } from "zod";

export const PRICE_TYPES = ["retail", "wholesale", "dealer"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  retail: "Розница",
  wholesale: "Опт",
  dealer: "Дилер",
};

export const manualOrderSchema = z.object({
  // Set when an existing Покупатель was picked -- the order then shows up
  // in their "Мои заказы". Empty for a new buyer (stored like a guest order).
  customerId: z.string().trim().optional(),
  customerName: z.string().trim().min(2, "Укажите покупателя").max(120),
  customerPhone: z.string().trim().min(5, "Укажите телефон покупателя").max(30),
  customerEmail: z.string().trim().email("Укажите корректный e-mail покупателя"),
  deliveryNote: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Выберите товар в каждой строке"),
        quantity: z.number().int().min(1, "Количество должно быть не меньше 1").max(9999),
        price: z.number().int().min(0, "Цена не может быть отрицательной"),
      })
    )
    .min(1, "Добавьте хотя бы одну позицию"),
});
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
