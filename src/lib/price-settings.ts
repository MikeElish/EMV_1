import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MARKUPS, type Markups } from "@/lib/pricing";

export async function getMarkups(): Promise<Markups> {
  const settings = await prisma.priceSettings.findUnique({ where: { id: 1 } });
  return settings
    ? {
        retailMarkup: settings.retailMarkup,
        wholesaleMarkup: settings.wholesaleMarkup,
        dealerMarkup: settings.dealerMarkup,
      }
    : DEFAULT_MARKUPS;
}

export async function getSuppliers() {
  return prisma.company.findMany({
    where: { type: { equals: "Поставщик", mode: "insensitive" } },
    select: { id: true, name: true, inn: true },
    orderBy: { name: "asc" },
  });
}
