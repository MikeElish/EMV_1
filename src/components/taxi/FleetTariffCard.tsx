"use client";

import { useState } from "react";
import { taxiContent } from "@/content/taxi";

type Car = { model: string; years: string };

type Tariff = {
  className: string;
  color: string;
  description: string;
  priceFrom: string;
  cars: Car[];
};

export function FleetTariffCard({ tariff }: { tariff: Tariff }) {
  const [open, setOpen] = useState(false);
  const isDark = tariff.color === "business";
  const buttonClass = isDark
    ? "bg-white/15 hover:bg-white/25"
    : "bg-black/10 hover:bg-black/20";

  return (
    <div className="relative isolate overflow-hidden rounded-xl">
      <span
        className={`tariff-card-fill tariff-card-fill--${tariff.color}`}
        aria-hidden="true"
      />

      <div
        className={`relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between tariff-text--${tariff.color}`}
      >
        <div>
          <h3 className="text-xl font-semibold">{tariff.className}</h3>
          <p className="mt-1 text-sm opacity-80">{tariff.description}</p>
          <p className="mt-2 font-semibold">{tariff.priceFrom}</p>
        </div>

        <div className="flex gap-3 sm:flex-col sm:items-stretch">
          <a
            href={`tel:${taxiContent.contacts.phoneHref}`}
            className={`rounded-md px-5 py-2 text-center text-sm font-medium transition-colors ${buttonClass}`}
          >
            Заказать
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`rounded-md px-5 py-2 text-center text-sm font-medium transition-colors ${buttonClass}`}
          >
            Машины {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      <div
        className={`relative grid transition-all duration-300 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className={`border-t border-black/10 px-6 py-4 tariff-text--${tariff.color}`}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="pb-2 font-normal">Модель</th>
                  <th className="pb-2 font-normal">Год выпуска</th>
                </tr>
              </thead>
              <tbody>
                {tariff.cars.map((car) => (
                  <tr key={car.model} className="border-t border-black/10">
                    <td className="py-2">{car.model}</td>
                    <td className="py-2 opacity-80">{car.years}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
