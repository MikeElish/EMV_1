import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { CrmLoginForm } from "@/components/crm/CrmLoginForm";
import { customerNextPath } from "@/lib/customer-next";

export default async function CrmLoginPage({ searchParams }: PageProps<"/crm">) {
  const customerNext = customerNextPath((await searchParams).next);
  const session = await getAdminSession();
  if (session?.userId) {
    redirect(
      session.role === "OWNER"
        ? "/admin"
        : session.role === "CUSTOMER"
          ? (customerNext ?? "/shop")
          : "/admin" /* the first section open to them (src/proxy.ts) */
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        <Link href="/" className="flex items-end gap-2 text-white transition-opacity hover:opacity-80">
          <Logo className="h-14 w-14" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </Link>
        <CrmLoginForm customerNext={customerNext} />
        <p className="-mt-2 text-sm text-white/60">
          Нет учётной записи?{" "}
          <Link
            href={customerNext ? `/crm/register?next=${encodeURIComponent(customerNext)}` : "/crm/register"}
            className="font-medium text-white underline underline-offset-4 hover:opacity-80"
          >
            Регистрация
          </Link>
        </p>
      </div>
    </main>
  );
}
