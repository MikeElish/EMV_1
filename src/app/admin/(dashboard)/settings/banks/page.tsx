import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { BanksSettings } from "@/components/admin/BanksSettings";

export default async function BanksSettingsPage() {
  await requireSection("settings.banks", "view");
  const [accounts, transactions] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.bankTransaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { bankAccount: { select: { name: true } }, order: { select: { orderNumber: true } } },
    }),
  ]);
  return (
    <BanksSettings
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        accountNumber: a.accountNumber,
        bik: a.bik ?? "",
        hasToken: !!a.tokenEnc,
        isActive: a.isActive,
        syncHours: a.syncHours,
        lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
        lastSyncNote: a.lastSyncNote,
      }))}
      transactions={transactions.map((t) => ({
        id: t.id,
        bank: t.bankAccount.name,
        date: t.date.toISOString(),
        incoming: t.incoming,
        amount: t.amount,
        counterparty: t.counterpartyName,
        inn: t.counterpartyInn,
        purpose: t.purpose,
        orderNumber: t.order?.orderNumber ?? null,
        matchNote: t.matchNote,
      }))}
    />
  );
}
