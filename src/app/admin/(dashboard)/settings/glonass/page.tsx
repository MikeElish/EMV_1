import { prisma } from "@/lib/prisma";
import { GlonassSettingsForm } from "@/components/admin/GlonassSettingsForm";

export default async function GlonassSettingsPage() {
  const settings = await prisma.glonassSettings.findUnique({ where: { id: 1 } });

  // The stored password never leaves the server -- only whether one is set.
  return (
    <GlonassSettingsForm
      initial={
        settings && {
          serverUrl: settings.serverUrl,
          login: settings.login,
          hasPassword: !!settings.passwordEnc,
          updatedAt: settings.updatedAt.toISOString(),
        }
      }
    />
  );
}
