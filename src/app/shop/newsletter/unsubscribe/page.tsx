import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { UnsubscribeButton } from "@/components/shop/NewsletterForms";

export const metadata: Metadata = { title: "Отписка от новостей", robots: { index: false } };

// A button, not an unsubscribe on opening: mail scanners open links in letters.
export default async function NewsletterUnsubscribePage({ searchParams }: PageProps<"/shop/newsletter/unsubscribe">) {
  const { t } = await searchParams;
  const token = typeof t === "string" && t.length >= 20 && t.length <= 64 ? t : null;
  const record = token ? await prisma.newsletterSubscriber.findUnique({ where: { token }, select: { email: true, unsubscribedAt: true } }) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      {!record ? (
        <>
          <h1 className="text-2xl font-bold">Ссылка недействительна</h1>
          <p className="mt-3 text-foreground/70">Напишите нам, и мы отпишем ваш адрес вручную.</p>
        </>
      ) : record.unsubscribedAt ? (
        <>
          <h1 className="text-2xl font-bold">Вы уже отписаны</h1>
          <p className="mt-3 text-foreground/70">На {record.email} новости больше не приходят.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Отписка от новостей</h1>
          <p className="mt-3 text-foreground/70">Больше не присылать новости EMV Запчасти на {record.email}?</p>
          <UnsubscribeButton token={token!} />
        </>
      )}
    </div>
  );
}
