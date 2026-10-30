"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashInvitationToken, isUserInvitationToken } from "@/lib/user-invitations";

export type InvitationActionResult = { ok: true } | { ok: false; error: string };

export async function completeUserInvitation(
  token: string,
  password: string,
): Promise<InvitationActionResult> {
  if (!isUserInvitationToken(token)) {
    return { ok: false, error: "Ссылка приглашения некорректна или уже недействительна." };
  }
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return { ok: false, error: "Пароль должен содержать не менее 8 символов и не более 72 байт." };
  }

  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { role: true } } },
  });
  if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) {
    return { ok: false, error: "Ссылка приглашения истекла или уже использована. Попросите владельца отправить новое приглашение." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  let completed = false;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.userInvitation.updateMany({
      where: { id: invitation.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return;
    await tx.user.update({
      where: { id: invitation.userId },
      data: {
        passwordHash,
        ...(invitation.user.role === "CUSTOMER" ? { emailVerifiedAt: now } : {}),
      },
    });
    completed = true;
  });
  if (!completed) {
    return { ok: false, error: "Ссылка приглашения уже использована или истекла." };
  }
  return { ok: true };
}
