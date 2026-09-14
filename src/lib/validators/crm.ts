import { z } from "zod";

export const ASSIGNABLE_ROLES = [
  "ADMIN",
  "MANAGER",
  "SENIOR_MANAGER",
  "CHIEF_MANAGER",
  "SUPPLIER",
  "MECHANIC",
  "DISPATCHER",
  "CUSTOMER",
  "DRIVER",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  SENIOR_MANAGER: "Старший менеджер",
  CHIEF_MANAGER: "Главный менеджер",
  SUPPLIER: "Снабженец",
  MECHANIC: "Механик",
  DISPATCHER: "Диспетчер",
  CUSTOMER: "Покупатель",
  DRIVER: "Водитель",
};

export const userSchema = z.object({
  lastName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  patronymic: z.string().trim().optional(),
  email: z.union([z.string().trim().email("Некорректный email"), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  role: z.enum(ASSIGNABLE_ROLES),
  companyId: z.string().trim().optional(),
  password: z.union([z.string().min(6, "Минимум 6 символов"), z.literal("")]).optional(),
});
export type UserInput = z.infer<typeof userSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа"),
  inn: z.string().trim().optional(),
  ogrn: z.string().trim().optional(),
  address: z.string().trim().optional(),
  contract: z.string().trim().optional(),
  type: z.string().trim().optional(),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const COMPANY_TYPE_SUGGESTIONS = ["Клиент", "Поставщик", "Перевозчик"];
