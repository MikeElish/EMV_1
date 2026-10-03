import { MailMessagePage } from "@/components/mail/MailPages";

export default async function Page({ params }: PageProps<"/admin/mail/inbox/[uid]">) {
  const { uid } = await params;
  return <MailMessagePage role="inbox" uid={uid} basePath="/admin/mail/inbox" />;
}
