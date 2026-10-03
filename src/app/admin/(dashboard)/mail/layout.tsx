import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { MailShell } from "@/components/mail/MailShell";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifyStaffSession();
  const account = await getMailAccount(userId);
  return <MailShell configured={!!account}>{children}</MailShell>;
}
