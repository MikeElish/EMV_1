import { prisma } from "@/lib/prisma";

// List-Unsubscribe-Post (RFC 8058): the mail app's «Отписаться» posts here.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (token && token.length >= 20 && token.length <= 64) {
    await prisma.newsletterSubscriber.updateMany({ where: { token, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
  }
  return new Response(null, { status: 200 });
}
