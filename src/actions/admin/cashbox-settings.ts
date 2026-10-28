"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { encryptSecret } from "@/lib/secret-box";
import { atolToken } from "@/lib/atol";
import { setupSbp } from "@/lib/sbp";
import { sendReceipt } from "@/lib/cash-receipts";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/admin/settings/cashbox";

const schema = z.object({
  atolLogin: z.string().trim().max(100),
  atolPassword: z.string().max(200),
  atolGroupCode: z.string().trim().max(100),
  sno: z.enum(["osn", "usn_income", "usn_income_outcome", "esn", "patent"]),
  vat: z.enum(["vat22", "vat20", "vat10", "vat5", "vat7", "vat0", "none"]),
  inn: z.string().trim().regex(/^(\d{10}|\d{12})$/, "ИНН — 10 или 12 цифр"),
  email: z.string().trim().email("Укажите e-mail магазина для чеков"),
  paymentAddress: z.string().trim().url("Адрес сайта — с https://"),
  receiptsEnabled: z.boolean(),
  sbpEnabled: z.boolean(),
  bankAccountId: z.string().trim(),
});
export type CashboxSettingsInput = z.infer<typeof schema>;

export async function saveCashboxSettings(input: CashboxSettingsInput): Promise<ActionResult> {
  const denied = await accessDenied("settings.cashbox");
  if (denied) return denied;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  const { atolPassword, bankAccountId, ...rest } = parsed.data;
  const existing = await prisma.cashboxSettings.findUnique({ where: { id: 1 } });
  if (rest.receiptsEnabled && !(atolPassword || existing?.atolPasswordEnc)) return { ok: false, error: "Укажите пароль АТОЛ Онлайн" };
  if (rest.receiptsEnabled && (!rest.atolLogin || !rest.atolGroupCode)) return { ok: false, error: "Укажите логин и код группы касс АТОЛ Онлайн" };
  if (rest.sbpEnabled && !bankAccountId) return { ok: false, error: "Выберите счёт Точки для СБП" };
  // Онлайн-оплата без чека нарушает 54-ФЗ.
  if (rest.sbpEnabled && !rest.receiptsEnabled) return { ok: false, error: "СБП включается вместе с чеками: оплата частного лица требует чека" };
  const accountChanged = (existing?.bankAccountId ?? "") !== bankAccountId;
  const data = {
    ...rest,
    bankAccountId: bankAccountId || null,
    ...(atolPassword ? { atolPasswordEnc: encryptSecret(atolPassword) } : {}),
    // Another account: its codes are looked up again («Проверить СБП»).
    ...(accountChanged ? { customerCode: null, merchantId: null } : {}),
  };
  await prisma.cashboxSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath(PATH);
  return { ok: true, message: rest.sbpEnabled && accountChanged ? "Сохранено. Нажмите «Проверить СБП»." : "Сохранено" };
}

/** «Проверить АТОЛ»: signs in with the saved login. */
export async function testAtol(): Promise<ActionResult> {
  const denied = await accessDenied("settings.cashbox");
  if (denied) return denied;
  const settings = await prisma.cashboxSettings.findUnique({ where: { id: 1 } });
  if (!settings) return { ok: false, error: "Сначала сохраните настройки" };
  try {
    const { version } = await atolToken(settings);
    return { ok: true, message: `АТОЛ Онлайн: вход выполнен (протокол ${version})` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** «Проверить СБП»: the token's customer code and active retail point are stored. */
export async function testSbp(): Promise<ActionResult> {
  const denied = await accessDenied("settings.cashbox");
  if (denied) return denied;
  const settings = await prisma.cashboxSettings.findUnique({ where: { id: 1 } });
  if (!settings?.bankAccountId) return { ok: false, error: "Сначала выберите счёт Точки и сохраните" };
  try {
    const r = await setupSbp(settings.bankAccountId);
    revalidatePath(PATH);
    return r.sbp
      ? { ok: true, message: `Точка: торговая точка «${r.name}» (${r.merchantId}), СБП доступна` }
      : { ok: false, error: `Торговая точка «${r.name}» найдена, но СБП в ней не включена` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function retryReceipt(id: string): Promise<ActionResult> {
  const denied = await accessDenied("settings.cashbox");
  if (denied) return denied;
  await sendReceipt(id);
  const r = await prisma.cashReceipt.findUnique({ where: { id }, select: { status: true, error: true } });
  revalidatePath(PATH);
  return r?.status === "fail" ? { ok: false, error: r.error ?? "Не отправлен" } : { ok: true, message: "Отправлен в АТОЛ" };
}
