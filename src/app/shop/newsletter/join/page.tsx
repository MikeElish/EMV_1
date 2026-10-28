import type { Metadata } from "next";
import { checkInviteSignature } from "@/lib/newsletter";
import { JoinByInvite } from "@/components/shop/NewsletterForms";

export const metadata: Metadata = { title: "Подписка на новости", robots: { index: false } };

/** From an invitation letter: one tick and «Подписаться», no confirmation letter needed. */
export default async function NewsletterJoinPage({ searchParams }: PageProps<"/shop/newsletter/join">) {
  const { e, s } = await searchParams;
  const email = typeof e === "string" ? e.trim().toLowerCase() : "";
  const signature = typeof s === "string" ? s : "";
  const valid = !!email && !!signature && checkInviteSignature(email, signature);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      {valid ? (
        <>
          <h1 className="text-center text-2xl font-bold">Новости EMV Запчасти</h1>
          <p className="mt-3 text-center text-foreground/70">
            Поступления запчастей на склад и специальные предложения — на {email}. Обычно не чаще раза в неделю.
          </p>
          <JoinByInvite email={email} signature={signature} />
        </>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold">Ссылка недействительна</h1>
          <p className="mt-3 text-center text-foreground/70">Подпишитесь через форму внизу любой страницы магазина.</p>
        </>
      )}
    </div>
  );
}
