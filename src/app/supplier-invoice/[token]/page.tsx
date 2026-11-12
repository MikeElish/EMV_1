import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SupplierInvoiceForm } from "@/components/supplier/SupplierInvoiceForm";
import { loadSupplierInvoice } from "@/lib/supplier-invoice-portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Счёт на оплату — EMV",
  robots: { index: false, follow: false },
};

export default async function SupplierInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const purchase = await loadSupplierInvoice(token);
  if (!purchase) notFound();

  return (
    <>
      <header className="flex h-20 shrink-0 items-center bg-black px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-end gap-2 text-white transition-opacity hover:opacity-80">
          <Logo className="h-12 w-12" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Заказ поставщику № {purchase.number}</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {purchase.supplierName}
          {purchase.orderNumber && ` · Заказ покупателя ${purchase.orderNumber}`}
        </p>
        {purchase.invoiceAt || purchase.hasPaymentRequest ? (
          <p className="mt-6 rounded-md border border-green-600/20 bg-green-600/5 p-4 text-sm text-green-700">
            Счёт получен. Благодарим!
          </p>
        ) : (
          <div className="mt-6">
            <SupplierInvoiceForm
              token={token}
              currency={purchase.currency}
              total={purchase.total}
              lines={purchase.lines}
            />
          </div>
        )}
      </main>
    </>
  );
}
