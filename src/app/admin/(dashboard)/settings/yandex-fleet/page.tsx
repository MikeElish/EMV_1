import { prisma } from "@/lib/prisma";
import { YandexFleetSettingsForm } from "@/components/admin/YandexFleetSettingsForm";

export default async function YandexFleetSettingsPage() {
  const settings = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 } });

  // The API key never leaves the server.
  return (
    <YandexFleetSettingsForm
      initial={
        settings && {
          parkId: settings.parkId,
          clientId: settings.clientId,
          updatedAt: settings.updatedAt.toISOString(),
        }
      }
    />
  );
}
