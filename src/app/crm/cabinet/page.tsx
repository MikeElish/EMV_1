import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { getMyAccess } from "@/lib/access-server";
import { firstVisible } from "@/lib/access";
import { logout } from "@/actions/admin/auth";
import { BackButton } from "@/components/crm/BackButton";

export default async function CrmCabinetPage() {
  const session = await getAdminSession();
  if (!session?.userId) redirect("/crm");
  const me = await getMyAccess();
  const staffStart = me ? firstVisible(me.access) : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <BackButton />
      <h1 className="text-xl font-bold">Личный кабинет в разработке</h1>
      <p className="text-sm text-foreground/60">
        Скоро здесь появится рабочее пространство для вашей роли.
      </p>
      {staffStart ? (
        <Link
          href={staffStart}
          className="rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Перейти к работе
        </Link>
      ) : (
        session.role !== "CUSTOMER" && (
          <p className="text-sm text-foreground/60">Разделы пока не открыты — обратитесь к владельцу.</p>
        )
      )}
      <form action={logout}>
        <button type="submit" className="text-sm underline underline-offset-4">
          Выйти
        </button>
      </form>
    </main>
  );
}
