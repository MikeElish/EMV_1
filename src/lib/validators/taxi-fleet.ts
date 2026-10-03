import { z } from "zod";

export const VEHICLE_STATUSES = ["FREE", "IN_WORK", "IN_REPAIR", "IN_RENT", "DECOMMISSIONED"] as const;
export const VEHICLE_STATUS_LABELS: Record<(typeof VEHICLE_STATUSES)[number], string> = {
  FREE: "Свободен",
  IN_WORK: "В работе",
  IN_REPAIR: "В ремонте",
  IN_RENT: "В аренде",
  DECOMMISSIONED: "Списание",
};

// ZXXXZZXX or ZXXXZZXXX (Z -- Latin letter, X -- digit), no spaces: letter,
// 3 digits, 2 letters, 2- or 3-digit region. Any case on input, stored
// upper-case. Shared with the form's HTML `pattern` so the browser rejects
// the same values the server does.
export const LICENSE_PLATE_PATTERN = "[A-Za-z][0-9]{3}[A-Za-z]{2}[0-9]{2,3}";
export const LICENSE_PLATE_HINT =
  "Без пробелов: ZXXXZZXX или ZXXXZZXXX (Z — латинская буква, X — цифра), например A123BC77";
const LICENSE_PLATE_REGEX = new RegExp(`^${LICENSE_PLATE_PATTERN}$`);

export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, "Укажите марку"),
  model: z.string().trim().min(1, "Укажите модель"),
  licensePlate: z
    .string()
    .trim()
    .regex(LICENSE_PLATE_REGEX, `Гос.номер: ${LICENSE_PLATE_HINT}`)
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
