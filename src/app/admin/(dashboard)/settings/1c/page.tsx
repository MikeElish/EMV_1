import { prisma } from "@/lib/prisma";
import { OneCSettingsForm } from "@/components/admin/OneCSettingsForm";

export default async function OneCSettingsPage() {
  const settings = await prisma.oneCSettings.findUnique({ where: { id: 1 } });
  // The password stays on the server until the owner presses «Показать».
  return (
    <OneCSettingsForm
      saved={
        settings && {
          baseUrl: settings.baseUrl,
          login: settings.login,
          updatedAt: settings.updatedAt.toISOString(),
        }
      }
    />
  );
}
