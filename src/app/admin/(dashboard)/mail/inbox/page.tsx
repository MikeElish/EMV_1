import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";
import { verifyStaffSession } from "@/lib/staff-dal";
import { processMailRules } from "@/lib/mail/rules";

export default async function Page({ searchParams }: PageProps<"/admin/mail/inbox">) {
  const { page } = await searchParams;
  // Rules first, so a letter that a rule moves away isn't shown here -- but
  // never keep the inbox waiting on a slow server.
  const { userId } = await verifyStaffSession();
  await Promise.race([
    processMailRules(userId).catch((error) => console.error("[mail-rules]", error)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  return <MailFolderPage role="inbox" basePath="/admin/mail/inbox" page={pageFromSearch(page)} />;
}
