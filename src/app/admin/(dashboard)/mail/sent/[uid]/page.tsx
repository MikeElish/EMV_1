import { MailMessagePage } from "@/components/mail/MailPages";

export default async function Page({ params }: PageProps<"/admin/mail/sent/[uid]">) {
  const { uid } = await params;
  return <MailMessagePage role="sent" uid={uid} basePath="/admin/mail/sent" />;
}
