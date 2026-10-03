import { z } from "zod";

export const MAIL_PAGE_SIZES = [10, 30, 50, 100] as const;
export const MAX_ATTACHMENTS_BYTES = 15 * 1024 * 1024;

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** "a@b.ru, Иван <c@d.ru>; e@f.ru" -> ["a@b.ru", "Иван <c@d.ru>", "e@f.ru"], or an error. */
export function parseRecipients(raw: string): { ok: true; list: string[] } | { ok: false; bad: string } {
  const list = raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const item of list) {
    const address = item.match(/<([^>]+)>\s*$/)?.[1] ?? item;
    if (!EMAIL_RE.test(address.trim())) return { ok: false, bad: item };
  }
  return { ok: true, list };
}

export const mailPreferencesSchema = z.object({
  senderName: z.string().trim().max(120).optional(),
  signature: z.string().max(2000).optional(),
  pageSize: z.coerce
    .number()
    .refine((n) => (MAIL_PAGE_SIZES as readonly number[]).includes(n), "Некорректное число писем на странице"),
});
export type MailPreferencesInput = z.infer<typeof mailPreferencesSchema>;

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название папки")
  .max(100, "Слишком длинное название")
  .refine((v) => !/[|/\\]/.test(v), "Название не должно содержать символы | / \\");
