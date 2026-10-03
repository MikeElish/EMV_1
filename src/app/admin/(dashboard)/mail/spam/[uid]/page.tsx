import { MailMessagePage } from "@/components/mail/MailPages";

export default async function Page({ params }: PageProps<"/admin/mail/spam/[uid]">) {
  const { uid } = await params;
  return <MailMessagePage role="junk" uid={uid} basePath="/admin/mail/spam" />;
}
