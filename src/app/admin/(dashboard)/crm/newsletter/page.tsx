import { prisma } from "@/lib/prisma";
import { oneCGetAll } from "@/lib/onec";
import { INVITES_PER_DAY, NEWSLETTER_SOURCE_LABELS } from "@/lib/newsletter";
import { getMoscowDayRangeUtc } from "@/lib/order-number";
import { absoluteUrl } from "@/lib/site";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { NewsletterTable } from "@/components/admin/NewsletterTable";
import { ArrivalsList, InvitesTable, NewsletterTabs, type Invitee } from "@/components/admin/NewsletterTools";

const ARRIVAL_DAYS = 30;

/** Clients' e-mails from 1С (Контрагенты → контактная информация), by counterparty name. */
async function oneCEmails(): Promise<{ email: string; name: string }[]> {
  type Row = { Description: string; КонтактнаяИнформация?: { Тип?: string; Представление?: string }[] };
  const rows = await oneCGetAll<Row & { Ref_Key: string }>("Catalog_Контрагенты", ["Ref_Key", "Description", "КонтактнаяИнформация"]).catch(
    () => [] as (Row & { Ref_Key: string })[]
  );
  const suppliers = new Set(
    (await prisma.company.findMany({ where: { type: "Поставщик", oneCRef: { not: null } }, select: { oneCRef: true } })).map((c) => c.oneCRef)
  );
  return rows
    .filter((r) => !suppliers.has(r.Ref_Key))
    .flatMap((r) =>
      (r.КонтактнаяИнформация ?? [])
        .filter((c) => c.Тип === "АдресЭлектроннойПочты" && c.Представление?.includes("@"))
        .map((c) => ({ email: c.Представление!.trim().toLowerCase(), name: r.Description.trim() }))
    );
}

/** In stock on the site and restocked within ARRIVAL_DAYS (the 1С stock sync bumps newArrivalAt). */
function recentArrivals() {
  const since = new Date(Date.now() - ARRIVAL_DAYS * 24 * 60 * 60 * 1000);
  return prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 }, newArrivalAt: { gte: since }, category: { isActive: true } },
    select: { id: true, sku: true, name: true, brand: true, slug: true, price: true, stock: true, newArrivalAt: true },
    orderBy: [{ newArrivalAt: "desc" }, { name: "asc" }],
  });
}

export default async function CrmNewsletterPage({ searchParams }: PageProps<"/admin/crm/newsletter">) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "invites" || rawTab === "arrivals" ? rawTab : "subscribers";
  const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { consentAt: "desc" } });
  const statusOf = new Map(
    subscribers.map((s) => [s.email, s.unsubscribedAt ? "unsubscribed" : s.confirmedAt ? "active" : "pending"] as const)
  );

  let content: React.ReactNode;
  if (tab === "invites") {
    const [invites, customers, fromOneC] = await Promise.all([
      prisma.newsletterInvite.findMany(),
      prisma.user.findMany({
        where: { role: "CUSTOMER", email: { not: null } },
        select: { email: true, firstName: true, lastName: true, company: { select: { name: true } } },
      }),
      oneCEmails(),
    ]);
    const list = new Map<string, Invitee>();
    const add = (email: string, name: string | null, from: string) => {
      const key = email.toLowerCase();
      if (!list.has(key)) list.set(key, { email: key, name, from, sentAt: null, status: statusOf.get(key) ?? null });
    };
    for (const i of invites) add(i.email, i.name, "Добавлен вручную");
    for (const u of customers) add(u.email!, [u.firstName, u.company?.name].filter(Boolean).join(", ") || null, "Покупатель на сайте");
    for (const c of fromOneC) add(c.email, c.name, "Контрагент 1С");
    for (const i of invites) list.get(i.email)!.sentAt = i.sentAt?.toISOString() ?? null;
    const { start } = getMoscowDayRangeUtc(new Date());
    const sentToday = invites.filter((i) => i.sentAt && i.sentAt >= start).length;
    content = <InvitesTable rows={[...list.values()]} leftToday={Math.max(0, INVITES_PER_DAY - sentToday)} perDay={INVITES_PER_DAY} />;
  } else if (tab === "arrivals") {
    const products = await recentArrivals();
    content = (
      <ArrivalsList
        days={ARRIVAL_DAYS}
        products={products.map((p) => ({ ...p, url: absoluteUrl(`/shop/product/${p.slug}`), newArrivalAt: p.newArrivalAt.toISOString() }))}
      />
    );
  } else {
    const users = await prisma.user.findMany({
      where: { email: { in: subscribers.map((s) => s.email) } },
      select: { email: true, firstName: true, lastName: true, company: { select: { name: true } } },
    });
    const byEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u]));
    content = (
      <NewsletterTable
        rows={subscribers.map((s) => {
          const u = byEmail.get(s.email);
          return {
            id: s.id,
            email: s.email,
            who: [[u?.lastName, u?.firstName].filter(Boolean).join(" "), u?.company?.name].filter(Boolean).join(" · "),
            source: NEWSLETTER_SOURCE_LABELS[s.source] ?? s.source,
            consentAt: s.consentAt.toISOString(),
            consentIp: s.consentIp ?? "",
            status: statusOf.get(s.email)!,
          };
        })}
      />
    );
  }

  return (
    <CrmPage>
      <NewsletterTabs tab={tab} />
      {content}
    </CrmPage>
  );
}
