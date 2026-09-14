import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

export default async function AdminSetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect("/crm");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-foreground/10 p-8">
        <h1 className="text-xl font-bold">Создание владельца</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Эта страница доступна только пока в системе нет ни одного
          пользователя.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
