import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";

export default async function Page({ searchParams }: PageProps<"/admin/mail/spam">) {
  const { page } = await searchParams;
  return <MailFolderPage role="junk" basePath="/admin/mail/spam" page={pageFromSearch(page)} />;
}
