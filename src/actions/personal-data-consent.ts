"use server";

import { prisma } from "@/lib/prisma";
import { getAdminSession, deleteAdminSession } from "@/lib/session";
import { needsPersonalDataConsent, setConsentPendingFlag } from "@/lib/personal-data-consent";
import { setEmailUnverifiedFlag } from "@/lib/email-verification";

async function currentUser() {
  const session = await getAdminSession();
  if (!session?.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, personalDataConsentAt: true },
  });
}

/** Whether the signed-in user still has to tick the consent (false for guests). */
export async function getPersonalDataConsentState(): Promise<{ required: boolean }> {
  const user = await currentUser();
  const required = !!user && needsPersonalDataConsent(user);
  await setConsentPendingFlag(required);
  return { required };
}

export async function acceptPersonalDataConsent(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Требуется вход в аккаунт" };
  if (!user.personalDataConsentAt) {
    await prisma.user.update({ where: { id: user.id }, data: { personalDataConsentAt: new Date() } });
  }
  await setConsentPendingFlag(false);
  return { ok: true };
}

/** No consent -- no account use: signs out. */
export async function declinePersonalDataConsent(): Promise<{ ok: true }> {
  await deleteAdminSession();
  await setConsentPendingFlag(false);
  await setEmailUnverifiedFlag(false);
  return { ok: true };
}
