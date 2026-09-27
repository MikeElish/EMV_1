import { z } from "zod";

export const MAIL_DEFAULTS = {
  smtpHost: "smtp.yandex.ru",
  smtpPort: 465,
  imapHost: "imap.yandex.ru",
  imapPort: 993,
};

const port = z.coerce.number().int().min(1, "Некорректный порт").max(65535, "Некорректный порт");

export const siteMailSchema = z.object({
  smtpHost: z.string().trim().min(1, "Укажите SMTP-сервер"),
  smtpPort: port,
  imapHost: z.string().trim().min(1, "Укажите IMAP-сервер"),
  imapPort: port,
  login: z.string().trim().min(1, "Укажите логин"),
  // Empty means "keep the stored password".
  password: z.string().optional(),
  senderEmail: z.string().trim().email("Некорректный адрес отправителя"),
  senderName: z.string().trim().optional(),
});
export type SiteMailInput = z.infer<typeof siteMailSchema>;

export const userMailboxSchema = z.object({
  login: z.string().trim().email("Логин должен быть адресом почты"),
  password: z.string().optional(),
});
export type UserMailboxInput = z.infer<typeof userMailboxSchema>;
