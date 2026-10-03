import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";

export default async function Page({ searchParams }: PageProps<"/admin/mail/inbox">) {
  const { page } = await searchParams;
  return <MailFolderPage role="inbox" basePath="/admin/mail/inbox" page={pageFromSearch(page)} />;
}
