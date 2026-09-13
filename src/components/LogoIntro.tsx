"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { Logo } from "@/components/Logo";

/**
 * Plays a short Lottie draw-in animation once, then swaps to the static
 * (theme-aware, currentColor) Logo SVG so dark mode keeps working afterwards.
 */
export function LogoIntro({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const animation: AnimationItem = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: "/animations/logo-intro.json",
    });

    animation.addEventListener("complete", () => setPlaying(false));

    return () => animation.destroy();
  }, []);

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <div
        ref={containerRef}
        className={`lottie-logo-intro absolute inset-0 ${
          playing ? "" : "hidden"
        }`}
        aria-hidden={!playing}
      />
      <Logo
        className={`h-full w-full transition-opacity duration-300 ${
          playing ? "opacity-0" : "opacity-100"
        }`}
      />
    </span>
  );
}
