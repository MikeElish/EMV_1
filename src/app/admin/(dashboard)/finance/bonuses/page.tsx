import { requireSection, getMyAccess } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { prisma } from "@/lib/prisma";
import { bonusesReport } from "@/lib/bonuses-report";
import { BonusesReportView } from "@/components/admin/BonusesReportView";

export default async function FinanceBonusesPage({ searchParams }: PageProps<"/admin/finance/bonuses">) {
  await requireSection("finance.bonuses");
  const period = parsePeriod(await searchParams);
  const [rows, me, settings] = await Promise.all([
    bonusesReport(period.from, period.to),
    getMyAccess(),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { manualInputEnabled: true } }),
  ]);
  return (
    <BonusesReportView
      period={period}
      rows={rows}
      canEditBonus={me?.role === "OWNER" && settings?.manualInputEnabled === true}
    />
  );
}
