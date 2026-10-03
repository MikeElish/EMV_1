import { MailMessagePage } from "@/components/mail/MailPages";

export default async function Page({ params, searchParams }: PageProps<"/admin/mail/folders/[uid]">) {
  const [{ uid }, { path }] = await Promise.all([params, searchParams]);
  const folderPath = typeof path === "string" ? path : "";
  return (
    <MailMessagePage
      path={folderPath}
      uid={uid}
      basePath={`/admin/mail/folders?path=${encodeURIComponent(folderPath)}`}
    />
  );
}
