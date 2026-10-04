import type { DeliveryMethod } from "@prisma/client";

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  ADDRESS: "До адреса",
  TERMINAL: "До терминала",
  PICKUP: "Самовывоз",
};

export const DELIVERY_METHODS = Object.keys(DELIVERY_METHOD_LABELS) as DeliveryMethod[];

/** The checkout forms write «Способ доставки: …» as the first line of the delivery note. */
export function deliveryMethodFromNote(note: string | null | undefined): DeliveryMethod | null {
  const match = note?.match(/Способ доставки: ([^\n]+)/);
  if (!match) return null;
  const label = match[1].trim();
  return DELIVERY_METHODS.find((m) => DELIVERY_METHOD_LABELS[m] === label) ?? null;
}
