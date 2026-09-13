"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  title: string;
  subtitle: string;
};

const MESSAGES: Message[] = [
  {
    title: "Запчасти для спецтехники",
    subtitle:
      "Экскаваторы, погрузчики, бульдозеры, краны и тракторы — оригинальные и совместимые запчасти в наличии и под заказ.",
  },
  {
    title: "Комплектующие для коммерческого транспорта",
    subtitle:
      "От фильтров до агрегатов для самосвалов, тягачей и автобусов.",
  },
  {
    title: "Прямые поставки",
    subtitle: "От производителей из Европы, Турции, Китая и Кореи.",
  },
  {
    title: "Изготовление запчастей",
    subtitle:
      "Многолетний опыт. Отличное качество. Быстро и с расширенной гарантией.",
  },
  {
    title: "Производство навесного оборудования",
    subtitle:
      "Ковши, отвалы, гидромолоты, траншеекопатели и многое другое под собственным брендом.",
  },
  {
    title: "Детали из полиуретана",
    subtitle: "Изготовление по чертежу. Восстановление колёс. Отличное качество.",
  },
];

const INTERVAL_MS = 5000;
const TRANSITION_MS = 600;

// Reel/"drum" effect: a track holding every message plus a clone of the
// first one at the end, sliding right-to-left. Once the clone scrolls
// fully into view, we jump back to the real first slide with transitions
// switched off for one frame -- invisible to the eye, but lets the reel
// scroll continuously in one direction instead of snapping back.
const SLIDES = [...MESSAGES, MESSAGES[0]];

export function HeroMessageCarousel() {
  const [index, setIndex] = useState(0);
  const [instant, setInstant] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex((i) => i + 1);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (index !== SLIDES.length - 1) return;
    const resetTimeout = setTimeout(() => {
      setInstant(true);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setInstant(false));
      });
    }, TRANSITION_MS);
    return () => clearTimeout(resetTimeout);
  }, [index]);

  return (
    <div className="max-w-2xl overflow-hidden">
      <h1 className="sr-only">{MESSAGES[0].title}</h1>
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: instant ? "none" : `transform ${TRANSITION_MS}ms ease`,
        }}
      >
        {SLIDES.map((message, i) => (
          <div key={i} className="w-full shrink-0 pr-4" aria-hidden={i !== index}>
            <p className="text-2xl font-bold text-white sm:text-3xl">
              {message.title}
            </p>
            <p className="mt-2 text-white/80">{message.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
