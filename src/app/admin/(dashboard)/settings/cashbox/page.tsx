import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { CashboxSettingsForm } from "@/components/admin/CashboxSettingsForm";

export default async function CashboxSettingsPage() {
  await requireSection("settings.cashbox", "view");
  const [settings, accounts, own, payments, receipts] = await Promise.all([
    prisma.cashboxSettings.findUnique({ where: { id: 1 } }),
    prisma.bankAccount.findMany({ where: { kind: "TOCHKA_API", tokenEnc: { not: null } }, select: { id: true, name: true, accountNumber: true } }),
    prisma.company.findFirst({ where: { isOwn: true }, select: { inn: true } }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { order: { select: { orderNumber: true } } } }),
    prisma.cashReceipt.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { order: { select: { orderNumber: true } } } }),
  ]);

  // The stored password never leaves the server -- only whether one is set.
  return (
    <CashboxSettingsForm
      initial={{
        atolLogin: settings?.atolLogin ?? "",
        hasPassword: !!settings?.atolPasswordEnc,
        atolGroupCode: settings?.atolGroupCode ?? "",
        sno: settings?.sno ?? "osn",
        vat: settings?.vat ?? "vat22",
        inn: settings?.inn || own?.inn || "",
        email: settings?.email ?? "",
        paymentAddress: settings?.paymentAddress ?? "https://emv.one",
        receiptsEnabled: settings?.receiptsEnabled ?? false,
        sbpEnabled: settings?.sbpEnabled ?? false,
        bankAccountId: settings?.bankAccountId ?? "",
        merchantId: settings?.merchantId ?? null,
      }}
      accounts={accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.accountNumber})` }))}
      payments={payments.map((p) => ({
        id: p.id,
        orderNumber: p.order.orderNumber,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
      }))}
      receipts={receipts.map((r) => ({
        id: r.id,
        orderNumber: r.order.orderNumber,
        kind: r.kind,
        amount: r.amount,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
