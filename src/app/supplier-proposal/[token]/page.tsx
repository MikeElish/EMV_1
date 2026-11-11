import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SupplierProposalForm } from "@/components/supplier/SupplierProposalForm";
import { loadSupplierQuote } from "@/lib/supplier-quote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Коммерческое предложение — EMV",
  robots: { index: false, follow: false },
};

export default async function SupplierProposalPage({
  params,
}: PageProps<"/supplier-proposal/[token]">) {
  const { token } = await params;
  const quote = await loadSupplierQuote(token);
  if (!quote) notFound();

  return (
    <>
      <header className="flex h-20 shrink-0 items-center bg-black px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-end gap-2 text-white transition-opacity hover:opacity-80">
          <Logo className="h-12 w-12" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {quote.rows.length ? (
          <SupplierProposalForm
            rows={quote.rows}
            token={token}
            templateUrl={`/api/supplier-proposal/${encodeURIComponent(token)}/template`}
            orderNumber={quote.orderNumber}
            supplierName={quote.supplierName}
          />
        ) : (
          <p className="rounded-md border border-foreground/10 px-4 py-6 text-sm text-foreground/60">
            Ссылка больше не активна: в запросе нет позиций со статусом «Проверка заказа».
          </p>
        )}
      </main>
    </>
  );
}
