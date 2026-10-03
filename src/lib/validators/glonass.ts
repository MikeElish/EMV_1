import { z } from "zod";

export const GLONASS_DEFAULT_SERVER = "https://hosting.glonasss.com";

export const glonassSettingsSchema = z.object({
  serverUrl: z
    .string()
    .trim()
    .url("Укажите адрес сервера, например https://hosting.glonasss.com")
    .refine((v) => /^https?:\/\//i.test(v), "Адрес должен начинаться с https://")
    .transform((v) => v.replace(/\/+(login)?\/*$/i, "")),
  login: z.string().trim().min(1, "Укажите логин"),
  // Empty means "keep the stored password".
  password: z.string().optional(),
});
export type GlonassSettingsInput = z.infer<typeof glonassSettingsSchema>;
