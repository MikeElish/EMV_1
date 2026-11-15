import "server-only";
import { prisma } from "@/lib/prisma";

export type LogisticsSettingsInput = {
  country: string;
  city: string;
  days: number;
};

export async function getLogisticsSettings() {
  return prisma.logisticsSetting.findMany({ orderBy: [{ country: "asc" }, { city: "asc" }] });
}

export async function getLogisticsDays(country: string | null | undefined, city: string | null | undefined): Promise<number> {
  if (!country || !city) return 0;
  const setting = await prisma.logisticsSetting.findUnique({ where: { country_city: { country, city } } });
  return setting?.days ?? 0;
}

export async function getOrderLogisticsDays(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { buyerCompanyId: true, userId: true },
  });
  if (!order) return 0;
  if (order.buyerCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: order.buyerCompanyId },
      select: { country: true, city: true },
    });
    return getLogisticsDays(company?.country, company?.city);
  }
  if (order.userId) {
    const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { defaultSettlement: true } });
    return getLogisticsDays("Россия", user?.defaultSettlement);
  }
  return 0;
}

export async function saveLogisticsSettings(settings: LogisticsSettingsInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.logisticsSetting.deleteMany();
    for (const s of settings) {
      if (!s.country.trim() || !s.city.trim() || s.days < 0) continue;
      await tx.logisticsSetting.create({ data: { country: s.country.trim(), city: s.city.trim(), days: s.days } });
    }
  });
}

const RU_CITY_RANGES: { maxKm?: number; days: number; cities?: string[] }[] = [
  { cities: ["Санкт-Петербург"], days: 1 },
  { maxKm: 1000, days: 3 },
  { maxKm: 5000, days: 7 },
  { maxKm: 10000, days: 14 },
];

export const DEFAULT_LOGISTICS_SETTINGS: LogisticsSettingsInput[] = [
  { country: "Китай", city: "*", days: 30 },
];

export function defaultDaysForRuCity(city: string): number | null {
  if (city === "Санкт-Петербург") return 1;
  // Only explicit defaults are known; custom ranges require geodata.
  return null;
}
