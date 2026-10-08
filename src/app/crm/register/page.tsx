import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { CrmRegisterForm } from "@/components/crm/CrmRegisterForm";
import { customerNextPath } from "@/lib/customer-next";

// Регистрация from the sign-in page: new accounts are customers (Покупатель);
// employees are added by the owner in CRM → Пользователи.
export default async function CrmRegisterPage({ searchParams }: PageProps<"/crm/register">) {
  const customerNext = customerNextPath((await searchParams).next);
  const signIn = customerNext ? `/crm?next=${encodeURIComponent(customerNext)}` : "/crm";
  if ((await getAdminSession())?.userId) redirect(signIn);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black py-10">
      <div className="relative z-10 flex w-full flex-col items-center gap-6 px-6">
        <Link href="/" className="flex items-end gap-2 text-white transition-opacity hover:opacity-80">
          <Logo className="h-14 w-14" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </Link>
        <h1 className="text-lg font-semibold text-white">Регистрация</h1>
        <CrmRegisterForm customerNext={customerNext} />
        <p className="text-sm text-white/60">
          Уже есть учётная запись?{" "}
          <Link href={signIn} className="font-medium text-white underline underline-offset-4 hover:opacity-80">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
