import {
  CarIcon,
  TaxiIcon,
  ExcavatorIcon,
  BulldozerIcon,
  DumpTruckIcon,
  LoaderIcon,
} from "./vehicles";

export type CityEmphasis = "none" | "taxi" | "construction";

type VehicleKind =
  | "car-a"
  | "car-b"
  | "car-c"
  | "taxi"
  | "excavator"
  | "bulldozer"
  | "dumptruck"
  | "loader";

function renderVehicle(kind: VehicleKind) {
  switch (kind) {
    case "car-a":
      return <CarIcon color="#94a3b8" />;
    case "car-b":
      return <CarIcon color="#60a5fa" />;
    case "car-c":
      return <CarIcon color="#f87171" />;
    case "taxi":
      return <TaxiIcon />;
    case "excavator":
      return <ExcavatorIcon />;
    case "bulldozer":
      return <BulldozerIcon />;
    case "dumptruck":
      return <DumpTruckIcon />;
    case "loader":
      return <LoaderIcon />;
  }
}

type Slot = {
  id: number;
  lane: "right" | "left";
  duration: number;
  delay: number;
};

const SLOTS: Slot[] = [
  { id: 0, lane: "right", duration: 9, delay: -1 },
  { id: 1, lane: "right", duration: 11, delay: -5 },
  { id: 2, lane: "right", duration: 8, delay: -3 },
  { id: 3, lane: "right", duration: 10, delay: -7 },
  { id: 4, lane: "left", duration: 9.5, delay: -2 },
  { id: 5, lane: "left", duration: 12, delay: -6 },
  { id: 6, lane: "left", duration: 8.5, delay: -4 },
  { id: 7, lane: "left", duration: 10.5, delay: -8 },
];

const KIND_BY_EMPHASIS: Record<CityEmphasis, Record<number, VehicleKind>> = {
  none: {
    0: "car-a",
    1: "car-b",
    2: "car-c",
    3: "car-a",
    4: "car-b",
    5: "car-c",
    6: "car-a",
    7: "car-b",
  },
  taxi: {
    0: "taxi",
    1: "taxi",
    2: "car-b",
    3: "taxi",
    4: "taxi",
    5: "car-c",
    6: "taxi",
    7: "taxi",
  },
  construction: {
    0: "excavator",
    1: "bulldozer",
    2: "car-b",
    3: "dumptruck",
    4: "loader",
    5: "excavator",
    6: "car-a",
    7: "bulldozer",
  },
};

export function CityScene({
  emphasis,
  className,
}: {
  emphasis: CityEmphasis;
  className?: string;
}) {
  const kinds = KIND_BY_EMPHASIS[emphasis];

  return (
    <div className={`city-scene pointer-events-none ${className ?? ""}`} aria-hidden="true">
      <div className="city-sky" />
      <div className="city-skyline">
        {BUILDING_HEIGHTS.map((h, i) => (
          <div key={i} className="city-building" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="city-road">
        <div className="city-lane city-lane--right">
          {SLOTS.filter((s) => s.lane === "right").map((slot) => (
            <div
              key={slot.id}
              className="city-vehicle city-vehicle--right"
              style={{
                animationDuration: `${slot.duration}s`,
                animationDelay: `${slot.delay}s`,
              }}
            >
              {renderVehicle(kinds[slot.id])}
            </div>
          ))}
        </div>
        <div className="city-lane city-lane--left">
          {SLOTS.filter((s) => s.lane === "left").map((slot) => (
            <div
              key={slot.id}
              className="city-vehicle city-vehicle--left"
              style={{
                animationDuration: `${slot.duration}s`,
                animationDelay: `${slot.delay}s`,
              }}
            >
              {renderVehicle(kinds[slot.id])}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const BUILDING_HEIGHTS = [40, 65, 50, 80, 55, 70, 45, 60, 35, 75, 50, 65];
