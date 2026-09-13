// Small flat/geometric vehicle silhouettes for the background city scene.
// All icons face right by default (the CityScene mirrors them for the
// opposite-direction lane).

export function CarIcon({ color = "#94a3b8" }: { color?: string }) {
  return (
    <svg viewBox="0 0 60 24" className="h-full w-full">
      <rect x="4" y="12" width="52" height="8" rx="3" fill={color} />
      <rect x="16" y="4" width="26" height="10" rx="3" fill={color} />
      <circle cx="16" cy="21" r="3.5" fill="#111" />
      <circle cx="44" cy="21" r="3.5" fill="#111" />
    </svg>
  );
}

export function TaxiIcon() {
  return (
    <svg viewBox="0 0 60 24" className="h-full w-full">
      <rect x="4" y="12" width="52" height="8" rx="3" fill="#f5c518" />
      <rect x="16" y="4" width="26" height="10" rx="3" fill="#f5c518" />
      <rect x="4" y="14.5" width="52" height="2" fill="#111" />
      <rect x="24" y="1" width="10" height="3.5" rx="1" fill="#111" />
      <rect x="26" y="1.7" width="2.5" height="2.1" fill="#f5c518" />
      <rect x="29.5" y="1.7" width="2.5" height="2.1" fill="#f5c518" />
      <circle cx="16" cy="21" r="3.5" fill="#111" />
      <circle cx="44" cy="21" r="3.5" fill="#111" />
    </svg>
  );
}

export function ExcavatorIcon() {
  return (
    <svg viewBox="0 0 60 26" className="h-full w-full">
      <rect x="2" y="20" width="40" height="4" rx="1.5" fill="#111" />
      <rect x="10" y="10" width="20" height="10" rx="2" fill="#f97316" />
      <rect x="10" y="12" width="8" height="6" rx="1" fill="#1e293b" />
      <path d="M28 12 L48 4 L52 6 L34 15 Z" fill="#f97316" />
      <path d="M48 3 L56 3 L52 9 Z" fill="#1e293b" />
    </svg>
  );
}

export function BulldozerIcon() {
  return (
    <svg viewBox="0 0 60 26" className="h-full w-full">
      <rect x="4" y="20" width="38" height="4" rx="1.5" fill="#111" />
      <rect x="12" y="9" width="24" height="11" rx="2" fill="#f97316" />
      <rect x="14" y="11" width="8" height="6" rx="1" fill="#1e293b" />
      <rect x="2" y="10" width="5" height="14" rx="1" fill="#94a3b8" />
    </svg>
  );
}

export function DumpTruckIcon() {
  return (
    <svg viewBox="0 0 60 26" className="h-full w-full">
      <rect x="4" y="8" width="38" height="12" rx="2" fill="#f97316" />
      <rect x="44" y="12" width="12" height="8" rx="2" fill="#f97316" />
      <rect x="46" y="14" width="7" height="5" rx="1" fill="#1e293b" />
      <circle cx="14" cy="21.5" r="3.5" fill="#111" />
      <circle cx="34" cy="21.5" r="3.5" fill="#111" />
      <circle cx="50" cy="21.5" r="3.5" fill="#111" />
    </svg>
  );
}

export function LoaderIcon() {
  return (
    <svg viewBox="0 0 60 26" className="h-full w-full">
      <rect x="18" y="10" width="24" height="10" rx="2" fill="#f97316" />
      <rect x="20" y="12" width="8" height="6" rx="1" fill="#1e293b" />
      <path d="M18 15 L4 15 L4 20 L10 20 L14 15" fill="#f97316" />
      <rect x="2" y="19" width="10" height="4" rx="1" fill="#1e293b" />
      <circle cx="16" cy="22" r="4" fill="#111" />
      <circle cx="40" cy="22" r="4" fill="#111" />
    </svg>
  );
}
