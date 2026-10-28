import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Подписка на новости", robots: { index: false } };

/** The link of the confirmation letter: the address is the subscriber's. */
export default async function NewsletterConfirmPage({ searchParams }: PageProps<"/shop/newsletter/confirm">) {
  const { t } = await searchParams;
  const token = typeof t === "string" && t.length >= 20 && t.length <= 64 ? t : null;
  const record = token ? await prisma.newsletterSubscriber.findUnique({ where: { token } }) : null;
  if (record && !record.confirmedAt) {
    await prisma.newsletterSubscriber.update({ where: { id: record.id }, data: { confirmedAt: new Date() } });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      {record && !record.unsubscribedAt ? (
        <>
          <h1 className="text-2xl font-bold">Подписка подтверждена</h1>
          <p className="mt-3 text-foreground/70">
            Будем присылать на {record.email} новости о поступлениях запчастей и специальные предложения. Отписаться
            можно по ссылке в любом письме.
          </p>
        </>
      ) : record ? (
        <>
          <h1 className="text-2xl font-bold">Вы отписаны</h1>
          <p className="mt-3 text-foreground/70">Адрес {record.email} отписан от новостей. Подписаться снова можно внизу любой страницы.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Ссылка недействительна</h1>
          <p className="mt-3 text-foreground/70">Подпишитесь ещё раз — форма внизу любой страницы магазина.</p>
        </>
      )}
      <Link href="/shop" className="mt-8 inline-block underline underline-offset-4">
        Перейти в каталог
      </Link>
    </div>
  );
}
