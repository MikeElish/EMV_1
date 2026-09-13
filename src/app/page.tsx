"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoIntro } from "@/components/LogoIntro";

const EXIT_DURATION_MS = 450;
const REVEAL_DURATION_MS = 500;

export default function SplashPage() {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return; // let the browser handle new-tab / modified clicks normally
    }
    event.preventDefault();
    setLeaving(true);
    setTimeout(() => router.push(href), EXIT_DURATION_MS);
  }

  const logoStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: revealed ? "10%" : "50%",
    transform: revealed
      ? "translate(-50%, 0) scale(0.6667)"
      : "translate(-50%, -50%) scale(1)",
    opacity: leaving ? 0 : 1,
    transition: `top ${REVEAL_DURATION_MS}ms ease, transform ${REVEAL_DURATION_MS}ms ease, opacity ${EXIT_DURATION_MS}ms ease`,
  };

  const buttonsRowStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "6%",
    transform: revealed ? "translateY(0)" : "translateY(12px)",
    opacity: revealed ? 1 : 0,
    pointerEvents: revealed && !leaving ? "auto" : "none",
    transition: `transform ${REVEAL_DURATION_MS}ms ease, opacity ${REVEAL_DURATION_MS}ms ease`,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="/videos/splash-intro.mp4"
        poster="/videos/splash-intro-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 z-0 bg-black/45" />

      <button
        type="button"
        onClick={() => setRevealed(true)}
        aria-expanded={revealed}
        style={logoStyle}
        className="group z-10 flex flex-col items-center gap-3 text-center text-white outline-none"
      >
        <LogoIntro className="h-28 w-28 transition-opacity duration-300 group-hover:opacity-70 group-focus-visible:opacity-70 sm:h-36 sm:w-36" />
        {!revealed && (
          <span className="whitespace-nowrap text-sm text-white/70">
            Нажмите на логотип, чтобы продолжить
          </span>
        )}
      </button>

      <div
        style={buttonsRowStyle}
        className="z-10 flex items-end justify-between gap-4 px-4 sm:px-12"
      >
        <Link
          href="/taxi"
          onClick={(e) => handleNavigate(e, "/taxi")}
          className={`taxi-checker-btn relative isolate w-[44%] overflow-hidden rounded-lg border border-white/40 px-6 py-4 text-center font-medium text-white transition-transform duration-[450ms] sm:w-56 md:w-64 ${
            leaving ? "-translate-x-[160%] opacity-0" : "translate-x-0"
          }`}
        >
          <span className="taxi-checker-fill" aria-hidden="true" />
          <span className="taxi-checker-glow" aria-hidden="true" />
          <span className="relative">Таксопарк</span>
        </Link>
        <Link
          href="/shop"
          onClick={(e) => handleNavigate(e, "/shop")}
          className={`shop-hazard-btn relative isolate w-[44%] overflow-hidden rounded-lg border border-white/40 px-6 py-4 text-center font-medium text-white transition-transform duration-[450ms] sm:w-56 md:w-64 ${
            leaving ? "translate-x-[160%] opacity-0" : "translate-x-0"
          }`}
        >
          <span className="shop-hazard-fill" aria-hidden="true" />
          <span className="shop-hazard-glow" aria-hidden="true" />
          <span className="relative">Магазин запчастей</span>
        </Link>
      </div>
    </main>
  );
}
