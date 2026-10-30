import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AcceptInvitationForm } from "@/components/crm/AcceptInvitationForm";
import { getUserInvitationInfo } from "@/lib/user-invitations";

export default async function AcceptInvitationPage({ searchParams }: PageProps<"/crm/accept-invite">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const invitation = await getUserInvitationInfo(token);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black py-10">
      <div className="relative z-10 flex w-full flex-col items-center gap-6 px-6">
        <Link href="/" className="flex items-end gap-2 text-white transition-opacity hover:opacity-80">
          <Logo className="h-14 w-14" />
          <span className="text-lg leading-none text-white/80">crm</span>
        </Link>
        <h1 className="text-lg font-semibold text-white">Приглашение в EMV</h1>
        <AcceptInvitationForm token={token} invitation={invitation} />
      </div>
    </main>
  );
}
