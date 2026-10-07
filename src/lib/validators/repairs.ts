import { z } from "zod";
import type { RepairLineKind, RepairShop, RepairStatus, RepairType } from "@prisma/client";

export const REPAIR_TYPE_LABELS: Record<RepairType, string> = {
  SCHEDULED_SERVICE: "Плановое ТО",
  BODY: "Кузовной",
  UNIT: "Агрегатный",
  OPERATIONAL: "Оперативный",
  TIRES: "Шиномонтаж",
};

export const REPAIR_SHOP_LABELS: Record<RepairShop, string> = {
  MECHANIC: "Механик",
  THIRD_PARTY: "Сторонний",
};

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  PLANNED: "Запланирован",
  IN_REPAIR: "В ремонте",
  AWAITING_PARTS: "В ожидании запчастей",
  DONE: "Выполнен",
  CANCELLED: "Отменён",
};

export const REPAIR_LINE_KIND_LABELS: Record<RepairLineKind, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Товар",
};

const keys = <T extends string>(labels: Record<T, string>) => Object.keys(labels) as [T, ...T[]];

export const repairSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  vehicleId: z.string().min(1, "Выберите технику"),
  type: z.enum(keys(REPAIR_TYPE_LABELS), { message: "Выберите вид ремонта" }),
  shop: z.enum(keys(REPAIR_SHOP_LABELS), { message: "Выберите цех" }),
  status: z.enum(keys(REPAIR_STATUS_LABELS), { message: "Выберите статус" }),
  note: z.string().trim().max(2000).optional(),
});
export type RepairInput = z.infer<typeof repairSchema>;

export const repairLineSchema = z.object({
  kind: z.enum(keys(REPAIR_LINE_KIND_LABELS)),
  productId: z.string().optional(),
  serviceId: z.string().optional(),
  name: z.string().trim().min(1, "Укажите наименование").max(300),
  quantity: z.number({ message: "Укажите количество" }).positive("Количество больше нуля").max(1_000_000),
  /** Rubles. */
  price: z.number({ message: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(100_000_000),
});
export type RepairLineInput = z.infer<typeof repairLineSchema>;
