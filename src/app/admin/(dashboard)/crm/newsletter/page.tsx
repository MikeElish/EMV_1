import { prisma } from "@/lib/prisma";
import { NEWSLETTER_SOURCE_LABELS } from "@/lib/newsletter";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { NewsletterTable } from "@/components/admin/NewsletterTable";

export default async function CrmNewsletterPage() {
  const list = await prisma.newsletterSubscriber.findMany({ orderBy: { consentAt: "desc" } });
  const users = await prisma.user.findMany({
    where: { email: { in: list.map((s) => s.email) } },
    select: { email: true, firstName: true, lastName: true, company: { select: { name: true } } },
  });
  const byEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u]));

  return (
    <CrmPage>
      <NewsletterTable
        rows={list.map((s) => {
          const u = byEmail.get(s.email);
          return {
            id: s.id,
            email: s.email,
            who: [[u?.lastName, u?.firstName].filter(Boolean).join(" "), u?.company?.name].filter(Boolean).join(" · "),
            source: NEWSLETTER_SOURCE_LABELS[s.source] ?? s.source,
            consentAt: s.consentAt.toISOString(),
            consentIp: s.consentIp ?? "",
            status: s.unsubscribedAt ? "unsubscribed" : s.confirmedAt ? "active" : "pending",
          };
        })}
      />
    </CrmPage>
  );
}
