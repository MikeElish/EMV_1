import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage() {
  const adminCount = await prisma.adminUser.count();
  if (adminCount === 0) {
    redirect("/admin/setup");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <LoginForm />
    </main>
  );
}
