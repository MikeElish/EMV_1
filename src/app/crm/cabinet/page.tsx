import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { logout } from "@/actions/admin/auth";
import { BackButton } from "@/components/crm/BackButton";

export default async function CrmCabinetPage() {
  const session = await getAdminSession();
  if (!session?.userId) redirect("/crm");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <BackButton />
      <h1 className="text-xl font-bold">Личный кабинет в разработке</h1>
      <p className="text-sm text-foreground/60">
        Скоро здесь появится рабочее пространство для вашей роли.
      </p>
      <form action={logout}>
        <button type="submit" className="text-sm underline underline-offset-4">
          Выйти
        </button>
      </form>
    </main>
  );
}
