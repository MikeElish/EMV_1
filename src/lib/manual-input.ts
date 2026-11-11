import "server-only";

import { getMyAccess } from "@/lib/access-server";
import { prisma } from "@/lib/prisma";

export async function ownerManualInputEnabled(): Promise<boolean> {
  const me = await getMyAccess();
  if (me?.role !== "OWNER") return false;
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { manualInputEnabled: true },
  });
  return settings?.manualInputEnabled === true;
}
