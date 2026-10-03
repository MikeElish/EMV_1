import { MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";

export default async function Page({ searchParams }: PageProps<"/admin/mail/drafts">) {
  const { page } = await searchParams;
  return <MailFolderPage role="drafts" basePath="/admin/mail/drafts" page={pageFromSearch(page)} />;
}
