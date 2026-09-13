import type { Metadata } from "next";
import { taxiContent } from "@/content/taxi";
import { DriverApplicationForm } from "@/components/taxi/DriverApplicationForm";

export const metadata: Metadata = {
  title: `${taxiContent.jobs.title} — ${taxiContent.companyName}`,
};

export default function JobsPage() {
  const { jobs } = taxiContent;

  return (
    <>
      <video
        className="fixed inset-0 -z-10 h-screen w-screen object-cover"
        src="/videos/taxi-jobs-seasons.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 -z-10 bg-black/45" />

      <section className="mx-auto max-w-5xl px-6 py-16 text-center text-white">
        <h1 className="text-4xl font-bold tracking-tight">{jobs.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          {jobs.location}
        </p>
        <p className="mt-1 text-sm text-white/50">{jobs.meetingPoint}</p>
      </section>

      <section className="border-y border-white/10 bg-black/45 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-16 text-white">
          <h2 className="text-2xl font-semibold">{jobs.intro}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {jobs.benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 p-4"
              >
                <span aria-hidden="true" className="text-white/40">
                  ✓
                </span>
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 text-white">
        <h2 className="text-2xl font-semibold">{jobs.valuesTitle}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {jobs.values.map((value) => (
            <div
              key={value.title}
              className="rounded-lg border border-white/15 bg-black/45 p-6 backdrop-blur-md"
            >
              <h3 className="font-medium">{value.title}</h3>
              <p className="mt-2 text-sm text-white/70">
                {value.description}
              </p>
              {"attribution" in value && value.attribution && (
                <p className="mt-2 text-xs text-white/40">
                  — {value.attribution}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/45 backdrop-blur-md">
        <div className="mx-auto max-w-md px-6 py-16 text-white">
          <h2 className="text-2xl font-semibold">{jobs.formTitle}</h2>
          <p className="mt-2 text-sm text-white/60">{jobs.formSubtitle}</p>
          <div className="mt-8 rounded-xl bg-white/95 p-6 text-foreground shadow-lg">
            <DriverApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
