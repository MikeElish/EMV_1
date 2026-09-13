import type { Metadata } from "next";
import { taxiContent } from "@/content/taxi";

export const metadata: Metadata = {
  title: `О компании — ${taxiContent.companyName}`,
};

export default function AboutPage() {
  return (
    <>
      <video
        className="fixed inset-0 -z-10 h-screen w-screen object-cover"
        src="/videos/taxi-about-seasons.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="fixed inset-0 -z-10 bg-black/45" />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-xl border border-white/15 bg-black/45 p-8 text-white backdrop-blur-md">
          <h1 className="text-3xl font-bold">{taxiContent.about.title}</h1>
          <div className="mt-6 space-y-4 text-white/80">
            {taxiContent.about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
