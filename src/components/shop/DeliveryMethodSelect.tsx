"use client";

import { SearchSelect } from "@/components/SearchSelect";

export type DeliveryMethod = "address" | "terminal" | "pickup";

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  address: "До адреса",
  terminal: "До терминала",
  pickup: "Самовывоз",
};
export const DELIVERY_OPTIONS = Object.keys(DELIVERY_LABELS) as DeliveryMethod[];

export function DeliveryMethodSelect({
  value,
  onChange,
}: {
  value: DeliveryMethod | null;
  onChange: (v: DeliveryMethod) => void;
}) {
  return (
    <SearchSelect
      value={value ?? ""}
      onChange={(next) => {
        const selected = DELIVERY_OPTIONS.find((option) => option === next);
        if (selected) onChange(selected);
      }}
      options={DELIVERY_OPTIONS.map((option) => ({
        value: option,
        label: DELIVERY_LABELS[option],
      }))}
      placeholder="Выберите способ"
      className="w-48"
    />
  );
}
