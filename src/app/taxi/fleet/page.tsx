import type { Metadata } from "next";
import { taxiContent } from "@/content/taxi";
import { FleetTariffCard } from "@/components/taxi/FleetTariffCard";

export const metadata: Metadata = {
  title: `Парк и тарифы — ${taxiContent.companyName}`,
};

export default function FleetPage() {
  return (
    <>
      <video
        className="fixed inset-0 -z-10 h-screen w-screen object-cover"
        src="/videos/taxi-fleet-seasons.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 -z-10 bg-black/45" />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-bold text-white">Парк и тарифы</h1>
        <div className="mt-10 flex flex-col gap-4">
          {taxiContent.fleet.map((tariff) => (
            <FleetTariffCard key={tariff.className} tariff={tariff} />
          ))}
        </div>
      </section>
    </>
  );
}
