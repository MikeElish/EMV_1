import { z } from "zod";

export const VEHICLE_STATUSES = ["FREE", "IN_WORK", "IN_REPAIR", "IN_RENT", "DECOMMISSIONED"] as const;
export const VEHICLE_STATUS_LABELS: Record<(typeof VEHICLE_STATUSES)[number], string> = {
  FREE: "Свободен",
  IN_WORK: "В работе",
  IN_REPAIR: "В ремонте",
  IN_RENT: "В аренде",
  DECOMMISSIONED: "Списание",
};

// X ZZZ XXX ZZZ, where X is a Latin letter and Z is a digit -- as specified,
// literally, not the real-world RU plate format (1 letter + 3 digits + 2
// letters + region code).
const LICENSE_PLATE_REGEX = /^[A-Za-z] \d{3} [A-Za-z]{3} \d{3}$/;

export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, "Укажите марку"),
  model: z.string().trim().min(1, "Укажите модель"),
  licensePlate: z
    .string()
    .trim()
    .regex(LICENSE_PLATE_REGEX, "Формат: X ZZZ XXX ZZZ (X — латинская буква, Z — цифра)")
    .transform((v) => v.toUpperCase()),
  vin: z.string().trim().min(1, "Укажите VIN-номер"),
  color: z.string().trim().min(1, "Укажите цвет"),
  year: z.coerce
    .number()
    .int()
    .min(1950, "Некорректный год выпуска")
    .max(new Date().getFullYear() + 1, "Некорректный год выпуска"),
  ptsNumber: z.string().trim().min(1, "Укажите номер ПТС"),
  ptsIssueDate: z.string().trim().min(1, "Укажите дату выдачи ПТС"),
  stsNumber: z.string().trim().min(1, "Укажите номер СТС"),
  stsIssueDate: z.string().trim().min(1, "Укажите дату выдачи СТС"),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;
