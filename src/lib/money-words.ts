// «14 500,00» → «Четырнадцать тысяч пятьсот рублей 00 копеек», as 1С prints under an invoice.

const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

/** «1 рубль», «2 рубля», «5 рублей». */
export function plural(n: number, forms: [string, string, string]): string {
  const m = Math.abs(n) % 100;
  if (m >= 11 && m <= 14) return forms[2];
  return m % 10 === 1 ? forms[0] : m % 10 >= 2 && m % 10 <= 4 ? forms[1] : forms[2];
}

function triad(n: number, feminine: boolean): string[] {
  const words = [HUNDREDS[Math.floor(n / 100)]];
  const rest = n % 100;
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]);
  else words.push(TENS[Math.floor(rest / 10)], (feminine ? ONES_F : ONES_M)[rest % 10]);
  return words.filter(Boolean);
}

const SCALES: { forms: [string, string, string]; feminine: boolean }[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
];

/** Whole number in words (masculine): 0 → «ноль». */
export function numberInWords(n: number): string {
  if (n === 0) return "ноль";
  const parts: string[] = [];
  for (let scale = 0, rest = Math.floor(n); rest > 0; scale++, rest = Math.floor(rest / 1000)) {
    const chunk = rest % 1000;
    if (!chunk) continue;
    const { forms, feminine } = SCALES[scale];
    parts.unshift([...triad(chunk, feminine), scale ? plural(chunk, forms) : ""].filter(Boolean).join(" "));
  }
  return parts.join(" ");
}

/** Kopecks → «Четырнадцать тысяч пятьсот рублей 00 копеек». */
export function rublesInWords(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  const text = `${numberInWords(rubles)} ${plural(rubles, ["рубль", "рубля", "рублей"])} ${String(kop).padStart(2, "0")} ${plural(kop, ["копейка", "копейки", "копеек"])}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
