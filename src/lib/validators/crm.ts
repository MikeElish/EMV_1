import { z } from "zod";

export const ASSIGNABLE_ROLES = [
  "ADMIN",
  "MANAGER",
  "SENIOR_MANAGER",
  "CHIEF_MANAGER",
  "SUPPLIER",
  "MECHANIC",
  "DISPATCHER",
  "ACCOUNTANT",
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
  ACCOUNTANT: "Бухгалтер",
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

export const COMPANY_PAYMENT_TYPES = ["PREPAYMENT", "DEFERRED"] as const;
export const COMPANY_PAYMENT_TYPE_LABELS: Record<(typeof COMPANY_PAYMENT_TYPES)[number], string> = {
  PREPAYMENT: "Предоплата",
  DEFERRED: "Отсрочка платежа",
};

export const COMPANY_PRICE_TYPES = ["RETAIL", "WHOLESALE", "DEALER", "INDIVIDUAL"] as const;
export const COMPANY_PRICE_TYPE_LABELS: Record<(typeof COMPANY_PRICE_TYPES)[number], string> = {
  RETAIL: "Розница",
  WHOLESALE: "Опт (цены сайта)",
  DEALER: "Дилер",
  INDIVIDUAL: "Индивидуальный",
};

export const companySchema = z
  .object({
    name: z.string().trim().min(2, "Минимум 2 символа"),
    inn: z.string().trim().optional(),
    kpp: z.string().trim().optional(),
    ogrn: z.string().trim().optional(),
    address: z.string().trim().optional(),
    hasContract: z.boolean().default(false),
    contract: z.string().trim().optional(),
    type: z.string().trim().optional(),
    managerId: z.string().trim().optional(),
    paymentType: z.enum(COMPANY_PAYMENT_TYPES).default("PREPAYMENT"),
    paymentDeferralDays: z.coerce.number().int().positive().optional(),
    priceType: z.enum(COMPANY_PRICE_TYPES).default("WHOLESALE"),
    individualMarkup: z.coerce.number().min(0, "Наценка не может быть отрицательной").max(1000).optional(),
  })
  .refine((data) => data.paymentType !== "DEFERRED" || !!data.paymentDeferralDays, {
    message: "Укажите количество дней отсрочки",
    path: ["paymentDeferralDays"],
  })
  .refine((data) => data.priceType !== "INDIVIDUAL" || data.individualMarkup !== undefined, {
    message: "Укажите индивидуальную наценку, %",
    path: ["individualMarkup"],
  });
export type CompanyInput = z.infer<typeof companySchema>;

export const COMPANY_TYPE_SUGGESTIONS = ["Клиент", "Поставщик", "Перевозчик"];
