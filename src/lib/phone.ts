// Phone mask: typing 0-6 or 9 starts/extends the significant number; typing
// 7, 8, or anything non-numeric is treated as the (already implied) "+7 ("
// trunk prefix and doesn't get inserted -- covers "9...", "89...", "79...",
// "+79..." all normalizing to the same "+7 (XXX) XXX-XX-XX".
export function digitsFromPhoneInput(raw: string): string {
  const allDigits = raw.replace(/\D/g, "");
  if (!allDigits) return "";
  const normalized = allDigits[0] === "7" || allDigits[0] === "8" ? allDigits.slice(1) : allDigits;
  return normalized.slice(0, 10);
}

export function formatRuPhone(digits: string): string {
  let out = "+7 (" + digits.slice(0, 3);
  if (digits.length >= 3) out += ")";
  if (digits.length > 3) out += " " + digits.slice(3, 6);
  if (digits.length > 6) out += "-" + digits.slice(6, 8);
  if (digits.length > 8) out += "-" + digits.slice(8, 10);
  return out;
}
