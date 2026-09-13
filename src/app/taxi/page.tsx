import Link from "next/link";
import { taxiContent } from "@/content/taxi";
import { HandwrittenReveal } from "@/components/taxi/HandwrittenReveal";
import { TariffsCarousel } from "@/components/taxi/TariffsCarousel";

export default function TaxiHomePage() {
  return (
    <>
      {/* Фиксированный фон на всю страницу: видео не уходит при прокрутке,
          контент секций скроллится поверх него. */}
      <video
        className="fixed inset-0 -z-10 h-screen w-screen object-cover"
        src="/videos/taxi-hero-stisaac.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 -z-10 bg-black/45" />

      <section className="relative py-20 text-center">
        <div className="relative mx-auto max-w-5xl px-6">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {taxiContent.hero.title}
          </h1>
          <div className="my-6 flex min-h-[190px] items-center justify-center sm:min-h-[240px]">
            <HandwrittenReveal
              text={taxiContent.hero.accent}
              className="text-xl sm:text-2xl"
            />
          </div>
          <p className="mx-auto max-w-2xl text-white/85">
            {taxiContent.hero.subtitle}
          </p>
          <a
            href="https://go.yandex/"
            target="_blank"
            rel="noopener noreferrer"
            className="relative isolate mt-8 inline-flex items-center gap-3 overflow-hidden rounded-md px-8 py-3 font-medium text-black shadow-lg transition-transform duration-200 hover:scale-105"
          >
            <span
              className="tariff-card-fill tariff-card-fill--white"
              aria-hidden="true"
            />
            <span className="relative">{taxiContent.hero.ctaText}</span>
            <img
              src="/images/yandex-go-icon.png"
              alt=""
              aria-hidden="true"
              className="relative h-6 w-6 object-contain"
            />
          </a>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/45 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-16 text-white">
          <h2 className="text-2xl font-semibold">Наши услуги</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {taxiContent.services.map((service) => (
              <div
                key={service.title}
                className="rounded-lg border border-white/15 bg-white/5 p-6"
              >
                <h3 className="font-medium">{service.title}</h3>
                <p className="mt-2 text-sm text-white/70">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/taxi/services"
            className="mt-8 inline-block text-sm font-medium underline underline-offset-4"
          >
            Все услуги →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center text-white">
        <h2 className="text-2xl font-semibold">Тарифы</h2>
        <TariffsCarousel tariffs={taxiContent.fleet} />
        <Link
          href="/taxi/fleet"
          className="mt-8 inline-block text-sm font-medium underline underline-offset-4"
        >
          Подробнее о парке и тарифах →
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center text-white">
        <h2 className="text-2xl font-semibold">Официальный перевозчик</h2>
        <div className="mt-8 flex justify-center">
          <a
            href="https://go.yandex/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Яндекс Go — официальный перевозчик"
            className="relative isolate flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl p-4 shadow-lg transition-transform duration-200 hover:scale-105"
          >
            <span
              className="tariff-card-fill tariff-card-fill--yandexgo"
              aria-hidden="true"
            />
            <img
              src="/images/yandex-go-icon.png"
              alt="Яндекс Go"
              className="relative h-full w-full object-contain"
            />
          </a>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/45 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center text-white">
          <h2 className="text-2xl font-semibold">
            {taxiContent.jobs.homeHeadline}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            {taxiContent.jobs.homeSubtitle}
          </p>
          <Link
            href="/taxi/jobs"
            className="mt-8 inline-block rounded-md bg-white px-8 py-3 font-medium text-black transition-opacity hover:opacity-90"
          >
            {taxiContent.jobs.ctaText}
          </Link>
        </div>
      </section>
    </>
  );
}
