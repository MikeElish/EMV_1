"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CrmEntryButton } from "@/components/CrmEntryButton";
import { taxiContent } from "@/content/taxi";
import { CookieNotice } from "@/components/CookieNotice";
import { MobileMenu, MOBILE_MENU_ITEM } from "@/components/MobileMenu";
import { PERSONAL_DATA_CONSENT_URL, USER_AGREEMENT_URL } from "@/lib/legal-docs";

const navLinks = [
  { href: "/taxi", label: "Главная" },
  { href: "/taxi/services", label: "Услуги" },
  { href: "/taxi/fleet", label: "Парк и тарифы" },
  { href: "/taxi/jobs", label: "Работа водителем" },
  { href: "/taxi/about", label: "О компании" },
  { href: "/taxi/contacts", label: "Контакты" },
];

export default function TaxiLayout({ children }: LayoutProps<"/taxi">) {
  // На страницах с анимированным акварельным видео-фоном шапка и подвал
  // прозрачные; на остальных страницах фона-видео нет, и им нужен
  // непрозрачный фон, чтобы текст оставался читаемым.
  const VIDEO_PAGES = new Set([
    "/taxi",
    "/taxi/services",
    "/taxi/fleet",
    "/taxi/jobs",
    "/taxi/about",
  ]);
  const isVideoPage = VIDEO_PAGES.has(usePathname());

  return (
    <>
      <header
        className={`relative border-b ${
          isVideoPage
            ? "border-white/15 bg-transparent"
            : "border-foreground/10 bg-background"
        }`}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <div
            className={`flex items-center gap-2 ${isVideoPage ? "text-white" : ""}`}
          >
            <Link href="/" aria-label="На начальную страницу EMV">
              <Logo className="h-8 w-8" />
            </Link>
            <Link href="/taxi" className="font-semibold">
              {taxiContent.companyName}
            </Link>
          </div>
          <nav className="hidden flex-wrap gap-x-5 gap-y-2 text-sm md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  isVideoPage
                    ? "text-white/80 hover:text-white"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href={`tel:${taxiContent.contacts.phoneHref}`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${
                isVideoPage
                  ? "bg-white text-black"
                  : "bg-foreground text-background"
              }`}
            >
              {taxiContent.contacts.phone}
            </a>
            <CrmEntryButton variant={isVideoPage ? "dark" : "light"} />
          </div>
          {/* Phones: a call button and ☰ with the sections. */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              href={`tel:${taxiContent.contacts.phoneHref}`}
              aria-label={`Позвонить: ${taxiContent.contacts.phone}`}
              className={`flex h-10 w-10 items-center justify-center rounded-md ${
                isVideoPage ? "bg-white text-black" : "bg-foreground text-background"
              }`}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
            </a>
            <MobileMenu light={isVideoPage} title={taxiContent.companyName}>
              {() => (
                <>
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} className={MOBILE_MENU_ITEM}>
                      {link.label}
                    </Link>
                  ))}
                  <div className="my-2 border-t border-foreground/10" />
                  <a href={`tel:${taxiContent.contacts.phoneHref}`} className={`${MOBILE_MENU_ITEM} font-medium`}>
                    {taxiContent.contacts.phone}
                  </a>
                  <Link href="/crm" className={MOBILE_MENU_ITEM}>
                    Вход в CRM
                  </Link>
                  <Link href="/" className={`${MOBILE_MENU_ITEM} text-foreground/60`}>
                    На главную EMV
                  </Link>
                </>
              )}
            </MobileMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        className={`relative border-t ${
          isVideoPage
            ? "border-white/15 bg-transparent"
            : "border-foreground/10 bg-background"
        }`}
      >
        <div
          className={`mx-auto flex max-w-5xl flex-col gap-2 px-4 sm:px-6 py-8 text-sm ${
            isVideoPage ? "text-white/70" : "text-foreground/60"
          }`}
        >
          <p>{taxiContent.companyName}</p>
          <p>
            {taxiContent.contacts.legalName} · ИНН {taxiContent.contacts.inn}
          </p>
          <p>{taxiContent.contacts.address}</p>
          <p>
            {taxiContent.contacts.phone} · {taxiContent.contacts.email} ·{" "}
            {taxiContent.contacts.workHours}
          </p>
          <p>
            <a href={USER_AGREEMENT_URL} target="_blank" rel="noopener" className="underline-offset-4 hover:underline">
              Пользовательское соглашение
            </a>{" "}
            ·{" "}
            <a href={PERSONAL_DATA_CONSENT_URL} target="_blank" rel="noopener" className="underline-offset-4 hover:underline">
              Согласие на обработку персональных данных
            </a>
          </p>
        </div>
      </footer>
      <CookieNotice />
    </>
  );
}
