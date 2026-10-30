import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/site";

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type InvitedUser = { id: string; login: string; email: string; firstName: string | null; lastName: string | null };

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserInvitation(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.userInvitation.upsert({
    where: { userId },
    create: {
      userId,
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    },
    update: {
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      usedAt: null,
      createdAt: now,
    },
  });
  return token;
}

export async function sendUserInvitation(user: InvitedUser): Promise<void> {
  const token = await createUserInvitation(user.id);
  const inviteUrl = absoluteUrl(`/crm/accept-invite?token=${encodeURIComponent(token)}`);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "пользователь";
  await sendSiteMail({
    to: user.email,
    subject: "Приглашение в EMV",
    text: [
      `Здравствуйте, ${name}!`,
      "",
      "Для вас создана учётная запись на emv.one.",
      `Ваш логин: ${user.login}`,
      "",
      "Перейдите по ссылке, чтобы задать пароль и войти. Ссылка действует 24 часа и может быть использована один раз:",
      inviteUrl,
      "",
      "Если вы не ожидали это письмо, обратитесь к владельцу EMV.",
    ].join("\n"),
  });
}

export async function getUserInvitationInfo(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      expiresAt: true,
      usedAt: true,
      user: { select: { login: true, email: true } },
    },
  });
  if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) return null;
  return {
    login: invitation.user.login,
    email: invitation.user.email,
  };
}

export function isUserInvitationToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
