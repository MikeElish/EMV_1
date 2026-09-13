import type { Metadata } from "next";
import { taxiContent } from "@/content/taxi";

export const metadata: Metadata = {
  title: `Услуги — ${taxiContent.companyName}`,
};

export default function ServicesPage() {
  return (
    <>
      <video
        className="fixed inset-0 -z-10 h-screen w-screen object-cover"
        src="/videos/taxi-uslugi-seasons.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 -z-10 bg-black/45" />

      <section className="mx-auto max-w-5xl px-6 py-16 text-white">
        <h1 className="text-3xl font-bold">Услуги</h1>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {taxiContent.services.map((service) => (
            <div
              key={service.title}
              className="rounded-lg border border-white/15 bg-black/45 p-6 backdrop-blur-md"
            >
              <h2 className="font-medium">{service.title}</h2>
              <p className="mt-2 text-sm text-white/70">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
