import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

export default async function AdminSetupPage() {
  const adminCount = await prisma.adminUser.count();
  if (adminCount > 0) {
    redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-foreground/10 p-8">
        <h1 className="text-xl font-bold">Создание первого администратора</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Эта страница доступна только пока в системе нет ни одного
          администратора.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
