import type { Metadata } from "next";
import { taxiContent } from "@/content/taxi";

export const metadata: Metadata = {
  title: `Контакты — ${taxiContent.companyName}`,
};

export default function ContactsPage() {
  const { contacts } = taxiContent;

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid gap-10 sm:grid-cols-2 sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Контакты</h1>
          <dl className="mt-8 space-y-4 text-foreground/80">
            <div>
              <dt className="text-sm text-foreground/50">Телефон</dt>
              <dd>
                <a href={`tel:${contacts.phoneHref}`} className="font-medium">
                  {contacts.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/50">Email</dt>
              <dd>
                <a href={`mailto:${contacts.email}`} className="font-medium">
                  {contacts.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/50">Офис</dt>
              <dd>{contacts.address}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/50">Режим работы</dt>
              <dd>{contacts.workHours}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/50">Мессенджеры</dt>
              <dd className="flex gap-4">
                <a
                  href={contacts.telegram}
                  className="underline underline-offset-4"
                >
                  Telegram
                </a>
                <a
                  href={contacts.whatsapp}
                  className="underline underline-offset-4"
                >
                  WhatsApp
                </a>
                <a href={contacts.max} className="underline underline-offset-4">
                  MAX
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/50">Реквизиты</dt>
              <dd>
                {contacts.legalName}
                <br />
                ИНН {contacts.inn}
              </dd>
            </div>
          </dl>
        </div>

        <img
          src="/images/contacts-illustration.png"
          alt=""
          aria-hidden="true"
          className="w-full select-none sm:justify-self-end"
        />
      </div>
    </section>
  );
}
