import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { CrmLoginForm } from "@/components/crm/CrmLoginForm";

export default async function CrmLoginPage() {
  const session = await getAdminSession();
  if (session?.userId) {
    redirect(session.role === "OWNER" ? "/admin" : "/crm/cabinet");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        <div className="flex items-end gap-2 text-white">
          <Logo className="h-14 w-14" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </div>
        <CrmLoginForm />
      </div>
    </main>
  );
}
