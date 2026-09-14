"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="absolute left-4 top-4 z-10 rounded-md border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/70 transition-opacity hover:opacity-80 sm:left-6 sm:top-6"
    >
      Назад
    </button>
  );
}
