import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { MailShell } from "@/components/mail/MailShell";
import { RememberMailPlace } from "@/components/mail/LastMailPlace";
import { Suspense } from "react";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifyStaffSession();
  const account = await getMailAccount(userId);
  return (
    <MailShell configured={!!account}>
      <Suspense>
        <RememberMailPlace userId={userId} />
      </Suspense>
      {children}
    </MailShell>
  );
}
