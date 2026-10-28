export const HANDOVER_KINDS = ["Выдан", "Передан в ТК"] as const;
export type HandoverKind = (typeof HANDOVER_KINDS)[number];

/** 1С's VAT rates of a Поступление line. */
export const VAT_RATES: Record<string, string> = { НДС22: "НДС 22%", НДС20: "НДС 20%", НДС10: "НДС 10%", НДС7: "НДС 7%", НДС5: "НДС 5%", БезНДС: "Без НДС" };
