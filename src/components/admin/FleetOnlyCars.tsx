import { FitWidth } from "@/components/FitWidth";
import Link from "next/link";
import type { FleetCar } from "@/lib/yandex-fleet-data";

/** Cars that exist in Яндекс.Флот but not in Техника, with a one-click "add". */
export function FleetOnlyCars({ cars }: { cars: FleetCar[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold">Есть в Яндекс.Флоте, нет в Технике</h2>
      {cars.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/40">Все автомобили из Яндекс.Флота уже есть в Технике.</p>
      ) : (
        <FitWidth>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 pr-4 font-normal">Марка</th>
              <th className="py-2 pr-4 font-normal">Модель</th>
              <th className="py-2 pr-4 font-normal">Гос.номер</th>
              <th className="py-2 pr-4 font-normal">Год</th>
              <th className="py-2 pr-4 font-normal">Цвет</th>
              <th className="py-2 pr-4 font-normal">Позывной</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car.id} className="border-b border-foreground/5">
                <td className="py-2 pr-4">{car.brand}</td>
                <td className="py-2 pr-4">{car.model}</td>
                <td className="py-2 pr-4">{car.number}</td>
                <td className="py-2 pr-4">{car.year ?? ""}</td>
                <td className="py-2 pr-4">{car.color}</td>
                <td className="py-2 pr-4">{car.callsign}</td>
                <td className="py-2 text-right">
                  <Link
                    href={`/admin/taxi-fleet/tech/new?fleetCar=${car.id}`}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Добавить в Технику
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </FitWidth>
      )}
    </section>
  );
}
