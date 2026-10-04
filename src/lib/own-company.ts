import "server-only";
import { prisma } from "@/lib/prisma";

/** Id of the site's own company "EMV" (created if somehow missing). */
export async function getOwnCompanyId(): Promise<string> {
  const own = await prisma.company.findFirst({ where: { isOwn: true }, select: { id: true } });
  if (own) return own.id;
  const created = await prisma.company.create({
    data: { id: "emv-own-company", name: "EMV", type: "Наша компания", isOwn: true },
  });
  return created.id;
}
