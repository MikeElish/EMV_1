"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { notifyClaimStatus, sendManualReturnLetter, sendSupplierClaim } from "@/lib/claims";
import { CLAIM_RESOLUTIONS, CLAIM_STATUSES } from "@/lib/validators/claims";

export type ClaimActionResult = { ok: true; message: string } | { ok: false; error: string };

/** CRM → Рекламации: status, decision, the answer to the customer; a new status is written to them. */
export async function updateClaim(
  id: string,
  input: { status: string; resolution: string; answer: string }
): Promise<ClaimActionResult> {
  const denied = await accessDenied("crm.claims");
  if (denied) return denied;
  if (!(CLAIM_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Некорректный статус" };
  if (input.resolution && !(CLAIM_RESOLUTIONS as readonly string[]).includes(input.resolution)) return { ok: false, error: "Некорректное решение" };
  const before = await prisma.claim.findUnique({ where: { id: String(id) }, select: { status: true } });
  if (!before) return { ok: false, error: "Рекламация не найдена" };
  await prisma.claim.update({
    where: { id: String(id) },
    data: { status: input.status, resolution: input.resolution || null, answer: input.answer.trim().slice(0, 2000) || null },
  });
  let message = "Сохранено";
  if (before.status !== input.status) {
    try {
      await notifyClaimStatus(String(id));
      message = "Сохранено, клиенту отправлено письмо";
    } catch (error) {
      console.error("[claims] status letter", error);
      message = "Сохранено, но письмо клиенту не ушло";
    }
    // Accepted: the return goes into 1С -- by hand while 1С has none to copy.
    if (input.status === "Принята") {
      try {
        if (await sendManualReturnLetter(String(id))) message += "; на emv@emv.one — инструкция для возврата в 1С";
      } catch (error) {
        console.error("[claims] 1С return letter", error);
        message += "; инструкция для 1С не ушла";
      }
    }
  }
  revalidatePath("/admin/crm/claims");
  revalidatePath("/shop/orders");
  return { ok: true, message };
}

/** «Претензия поставщику»: the defect with the photos, to the supplier's contact. */
export async function claimToSupplier(id: string): Promise<ClaimActionResult> {
  const denied = await accessDenied("crm.claims");
  if (denied) return denied;
  try {
    const supplier = await sendSupplierClaim(String(id));
    revalidatePath("/admin/crm/claims");
    return { ok: true, message: `Претензия отправлена: ${supplier}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Письмо не отправлено" };
  }
}
