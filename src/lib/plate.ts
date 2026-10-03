// Plates come in different spellings: "А 137 МВ 778" (GLONASS, Cyrillic),
// "А137МВ778" (Яндекс.Флот), "A137MB778" (Техника, Latin). Normalise all of
// them to the Техника form to match vehicles up.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X",
};

export function normalizePlate(plate: string) {
  return plate
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[АВЕКМНОРСТУХ]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? ch);
}
