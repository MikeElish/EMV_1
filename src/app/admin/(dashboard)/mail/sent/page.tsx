import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";

export default async function Page({ searchParams }: PageProps<"/admin/mail/sent">) {
  const { page } = await searchParams;
  return <MailFolderPage role="sent" basePath="/admin/mail/sent" page={pageFromSearch(page)} />;
}
