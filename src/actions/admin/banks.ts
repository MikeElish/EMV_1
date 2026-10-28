"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { encryptSecret } from "@/lib/secret-box";
import { BANK_KINDS, parseClientBankStatement, saveStatement, syncBankAccount } from "@/lib/banks";

export type BankResult = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/admin/settings/banks";

export async function saveBankAccount(
  id: string | null,
  input: { name: string; kind: string; accountNumber: string; bik: string; token: string; isActive: boolean }
): Promise<BankResult> {
  const denied = await accessDenied("settings.banks");
  if (denied) return denied;
  const name = input.name.trim();
  const accountNumber = input.accountNumber.replace(/\D/g, "");
  if (!name) return { ok: false, error: "Укажите название" };
  if (!(input.kind in BANK_KINDS)) return { ok: false, error: "Выберите способ загрузки" };
  if (accountNumber.length !== 20) return { ok: false, error: "Номер счёта — 20 цифр" };
  const bik = input.bik.replace(/\D/g, "");
  if (bik && bik.length !== 9) return { ok: false, error: "БИК — 9 цифр" };
  const data = {
    name,
    kind: input.kind,
    accountNumber,
    bik: bik || null,
    isActive: input.isActive,
    // An empty field keeps the token already saved.
    ...(input.token.trim() ? { tokenEnc: encryptSecret(input.token.trim()) } : {}),
  };
  if (id) await prisma.bankAccount.update({ where: { id }, data });
  else await prisma.bankAccount.create({ data });
  revalidatePath(PATH);
  return { ok: true, message: "Сохранено" };
}

export async function deleteBankAccount(id: string): Promise<BankResult> {
  const denied = await accessDenied("settings.banks");
  if (denied) return denied;
  await prisma.bankAccount.delete({ where: { id: String(id) } });
  revalidatePath(PATH);
  return { ok: true, message: "Удалено" };
}

/** «Загрузить выписку сейчас» (Точка). */
export async function syncBankNow(id: string): Promise<BankResult> {
  const denied = await accessDenied("settings.banks");
  if (denied) return denied;
  try {
    const note = await syncBankAccount(String(id));
    revalidatePath(PATH);
    revalidatePath("/admin/crm/orders");
    return { ok: true, message: note };
  } catch (error) {
    revalidatePath(PATH);
    return { ok: false, error: error instanceof Error ? error.message : "Банк не ответил" };
  }
}

/** «Загрузить файл выписки»: kl_to_1c.txt of any bank. */
export async function uploadStatement(formData: FormData): Promise<BankResult> {
  const denied = await accessDenied("settings.banks");
  if (denied) return denied;
  const account = await prisma.bankAccount.findUnique({ where: { id: String(formData.get("accountId") ?? "") } });
  const file = formData.get("file");
  if (!account) return { ok: false, error: "Счёт не найден" };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл выписки" };
  try {
    const lines = parseClientBankStatement(Buffer.from(await file.arrayBuffer()), account.accountNumber);
    if (!lines.length) return { ok: false, error: `В файле нет операций по счёту ${account.accountNumber}` };
    const r = await saveStatement(account.id, lines);
    const note = `Файл ${file.name}: операций ${lines.length}, новых ${r.added}, оплачено заказов ${r.paid}`;
    await prisma.bankAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(), lastSyncNote: note } });
    revalidatePath(PATH);
    revalidatePath("/admin/crm/orders");
    return { ok: true, message: note };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось разобрать файл" };
  }
}
