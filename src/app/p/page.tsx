import { Logo } from "@/components/Logo";

export default function InDevelopmentPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <Logo className="h-16 w-16" />
      <h1 className="text-xl font-semibold">Сайт в разработке</h1>
      <p className="text-white/70">Скоро вернёмся!</p>
    </main>
  );
}
