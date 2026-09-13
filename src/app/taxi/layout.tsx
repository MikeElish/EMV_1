"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { taxiContent } from "@/content/taxi";

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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
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
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
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
          className={`mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm ${
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
        </div>
      </footer>
    </>
  );
}
