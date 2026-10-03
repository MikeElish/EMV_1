import { z } from "zod";

export const DEFAULT_YANDEX_PARK_ID = "305a2a1772584c559d008128fd05562b";

/** Accepts the bare ID or a whole fleet.yandex.ru link with ?park_id=... */
export function extractParkId(value: string) {
  const fromUrl = value.match(/[?&]park_id=([0-9a-f]+)/i)?.[1];
  return (fromUrl ?? value).trim().toLowerCase();
}

export const yandexFleetSettingsSchema = z.object({
  parkId: z
    .string()
    .transform(extractParkId)
    .refine((v) => /^[0-9a-f]{32}$/.test(v), "ID парка — 32 символа из цифр и букв a–f (или ссылка из кабинета с park_id=…)"),
  clientId: z
    .string()
    .trim()
    .regex(/^taxi\/park\/[0-9a-f]{32}$/i, "Client ID имеет вид taxi/park/<ID парка>"),
  // Empty means "keep the stored key".
  apiKey: z.string().trim().optional(),
});
export type YandexFleetSettingsInput = z.input<typeof yandexFleetSettingsSchema>;
