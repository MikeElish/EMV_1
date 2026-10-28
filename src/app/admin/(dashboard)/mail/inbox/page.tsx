import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";
import { verifyStaffSession } from "@/lib/staff-dal";
import { processMailRules } from "@/lib/mail/rules";

export default async function Page({ searchParams }: PageProps<"/admin/mail/inbox">) {
  const { page } = await searchParams;
  // Rules run every minute anyway; opening Входящие starts a run without
  // waiting for it (a letter a rule moves may show here until the next visit).
  const { userId } = await verifyStaffSession();
  processMailRules(userId).catch((error) => console.error("[mail-rules]", error));
  return <MailFolderPage role="inbox" basePath="/admin/mail/inbox" page={pageFromSearch(page)} />;
}
