import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SupplierInvoiceForm } from "@/components/supplier/SupplierInvoiceForm";
import { formatSupplierCurrency } from "@/lib/supplier-currency";
import { loadSupplierInvoice } from "@/lib/supplier-invoice-portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Загрузка счёта — EMV",
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Заказ поставщику № {purchase.number}</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {purchase.supplierName}
          {purchase.orderNumber && ` · Заказ покупателя ${purchase.orderNumber}`}
        </p>
        <div className="mt-6 overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-foreground/60">
              <tr>
                <th className="px-3 py-2">Наименование</th>
                <th className="px-3 py-2">Артикул</th>
                <th className="px-3 py-2">Назначение</th>
                <th className="px-3 py-2 text-right">Количество</th>
                <th className="px-3 py-2 text-right">Цена, {purchase.currency}</th>
                <th className="px-3 py-2 text-right">Стоимость, {purchase.currency}</th>
              </tr>
            </thead>
            <tbody>
              {purchase.lines.map((line, index) => (
                <tr key={`${line.sku}-${index}`} className="border-t border-foreground/10">
                  <td className="px-3 py-2">{line.name}</td>
                  <td className="px-3 py-2">{line.sku}</td>
                  <td className="px-3 py-2">{line.source}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatSupplierCurrency(line.price, purchase.currency)}</td>
                  <td className="px-3 py-2 text-right">{formatSupplierCurrency(line.price * line.quantity, purchase.currency)}</td>
                </tr>
              ))}
              <tr className="border-t border-foreground/10 font-semibold">
                <td colSpan={5} className="px-3 py-2 text-right">Итого</td>
                <td className="px-3 py-2 text-right">{formatSupplierCurrency(purchase.total, purchase.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Счёт на оплату</h2>
          {purchase.invoiceAt || purchase.hasPaymentRequest ? (
            <p className="mt-2 rounded-md border border-green-600/20 bg-green-600/5 p-4 text-sm text-green-700">
              Счёт получен. Благодарим!
            </p>
          ) : (
            <SupplierInvoiceForm token={token} />
          )}
        </section>
      </main>
    </>
  );
}
